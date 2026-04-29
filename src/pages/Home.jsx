import { useNavigate } from 'react-router-dom';
import { PlusCircle, FileText } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="page-container">
      <h1 className="page-title">Welcome to InvoiceGen</h1>
      <p className="home-subtitle">Manage your work orders efficiently. Choose an action below to get started.</p>

      <div className="home-actions">
        <button className="home-card" onClick={() => navigate('/create')}>
          <div className="home-card-icon create">
            <PlusCircle size={28} />
          </div>
          <div className="home-card-content">
            <h3>Create work order</h3>
            <p>Create a new work order entry with all required details.</p>
          </div>
        </button>

        <button className="home-card" onClick={() => navigate('/records')}>
          <div className="home-card-icon records">
            <FileText size={28} />
          </div>
          <div className="home-card-content">
            <h3>My Requests</h3>
            <p>View, filter, and edit all existing work order records.</p>
          </div>
        </button>
      </div>
    </div>
  );
}
