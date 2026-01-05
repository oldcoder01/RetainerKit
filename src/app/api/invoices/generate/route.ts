import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getPool } from "@/lib/db";
import { getActiveWorkspaceForUser } from "@/lib/workspace";
import { requireContractorWorkspace } from "@/lib/authz";

type GenerateBody = {
  contractId?: string;
  periodStart?: string; // YYYY-MM-DD
  periodEnd?: string;   // YYYY-MM-DD
  hourlyRateCents?: number; // optional override, otherwise from contract
  currency?: string; // optional override, otherwise from contract
  preview?: boolean;
};

type ContractRow = {
  id: string;
  hourly_rate_cents: number | null;
  currency: string;
};

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
}

function computeAmountCents(totalMinutes: number, hourlyRateCents: number): number {
  // amount_cents = round(total_minutes * hourly_rate_cents / 60)
  // Use integer math with half-up rounding.
  const numerator = BigInt(totalMinutes) * BigInt(hourlyRateCents);
  const amount = (numerator + 30n) / 60n;
  if (amount > BigInt(1000000000)) return 1000000000;
  return Number(amount);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as GenerateBody;

  const contractId = (body.contractId ?? "").trim();
  const periodStart = (body.periodStart ?? "").trim();
  const periodEnd = (body.periodEnd ?? "").trim();
  const preview = Boolean(body.preview);

  if (!isUuid(contractId)) {
    return NextResponse.json({ error: "contractId is required and must be a UUID." }, { status: 400 });
  }
  if (!isIsoDate(periodStart) || !isIsoDate(periodEnd)) {
    return NextResponse.json({ error: "periodStart and periodEnd must be YYYY-MM-DD." }, { status: 400 });
  }
  if (periodStart > periodEnd) {
    return NextResponse.json({ error: "periodStart must be <= periodEnd." }, { status: 400 });
  }

  const ws = await getActiveWorkspaceForUser(session.user.id);
  const gate = requireContractorWorkspace(ws);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const pool = getPool();

  const contractRes = await pool.query<ContractRow>(
    `
      SELECT id, hourly_rate_cents, currency
      FROM contracts
      WHERE id = $1 AND workspace_id = $2
    `,
    [contractId, ws.id]
  );

  if (contractRes.rowCount === 0) {
    return NextResponse.json({ error: "Contract not found in your workspace." }, { status: 404 });
  }

  const contract = contractRes.rows[0];

  const rateOverride = body.hourlyRateCents;
  const hourlyRateCents = rateOverride ?? contract.hourly_rate_cents;
  if (hourlyRateCents === null || hourlyRateCents === undefined) {
    return NextResponse.json(
      { error: "No hourly rate is set for this contract. Set contracts.hourly_rate_cents or provide an override." },
      { status: 400 }
    );
  }
  if (!Number.isInteger(hourlyRateCents) || hourlyRateCents <= 0 || hourlyRateCents > 1000000000) {
    return NextResponse.json({ error: "hourlyRateCents must be a positive integer." }, { status: 400 });
  }

  const currency = normalizeCurrency(body.currency ?? contract.currency ?? "USD");
  if (currency.length !== 3) {
    return NextResponse.json({ error: "Currency must be a 3-letter code (e.g., USD)." }, { status: 400 });
  }

  const minutesRes = await pool.query<{ total_minutes: number }>(
    `
      SELECT COALESCE(SUM(minutes), 0)::int AS total_minutes
      FROM work_logs
      WHERE workspace_id = $1
        AND contract_id = $2
        AND work_date BETWEEN $3::date AND $4::date
    `,
    [ws.id, contractId, periodStart, periodEnd]
  );

  const totalMinutes = minutesRes.rows[0]?.total_minutes ?? 0;
  if (!Number.isInteger(totalMinutes) || totalMinutes < 0) {
    return NextResponse.json({ error: "Failed to compute total minutes." }, { status: 500 });
  }

  const amountCents = computeAmountCents(totalMinutes, hourlyRateCents);

  if (preview) {
    return NextResponse.json(
      {
        preview: {
          contractId,
          periodStart,
          periodEnd,
          totalMinutes,
          hourlyRateCents,
          amountCents,
          currency,
        },
      },
      { status: 200 }
    );
  }

  // Prevent overlapping invoices for this contract/range
  const overlap = await pool.query<{ id: string; period_start: string; period_end: string }>(
    `
      SELECT id,
             period_start::text AS period_start,
             period_end::text AS period_end
      FROM invoices
      WHERE workspace_id = $1
        AND contract_id = $2
        AND NOT (period_end < $3::date OR period_start > $4::date)
      ORDER BY period_start ASC
      LIMIT 1
    `,
    [ws.id, contractId, periodStart, periodEnd]
  );

  if (overlap.rowCount > 0) {
    const o = overlap.rows[0];
    return NextResponse.json(
      { error: `Overlapping invoice exists (${o.period_start} → ${o.period_end}).` },
      { status: 409 }
    );
  }

  const insert = await pool.query(
    `
      INSERT INTO invoices (
        workspace_id,
        contract_id,
        period_start,
        period_end,
        amount_cents,
        currency,
        status,
        created_by_user_id
      )
      VALUES ($1, $2, $3::date, $4::date, $5, $6, 'draft', $7)
      RETURNING *
    `,
    [ws.id, contractId, periodStart, periodEnd, amountCents, currency, session.user.id]
  );

  return NextResponse.json(
    {
      invoice: insert.rows[0],
      breakdown: {
        contractId,
        periodStart,
        periodEnd,
        totalMinutes,
        hourlyRateCents,
        amountCents,
        currency,
      },
    },
    { status: 201 }
  );
}
