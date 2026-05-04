import ProfileDropdown from './ProfileDropdown';

export default function TopBar({ user, userRoles }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        {/* Placeholder for breadcrumbs or page title */}
      </div>
      <div className="topbar-right">
        <ProfileDropdown user={user} userRoles={userRoles} />
      </div>
    </header>
  );
}
