import { LinkProviders } from "@/components/LinkProviders";

export default function AccountPage() {
  return (
    <div className="space-y-6">
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title">Account</h2>
          <p className="text-sm text-base-content/70">
            Link an OAuth provider to your existing account.
          </p>
        </div>
      </div>

      <LinkProviders />
    </div>
  );
}
