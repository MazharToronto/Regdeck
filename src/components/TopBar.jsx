import ProfileDropdown from './ProfileDropdown';

export default function TopBar({ user }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        {/* Placeholder for breadcrumbs or page title */}
      </div>
      <div className="topbar-right">
        <ProfileDropdown user={user} />
      </div>
    </header>
  );
}
