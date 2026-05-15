import React from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';

export default function DeleteConfirmationModal({ isOpen, onClose, onConfirm, title = "Delete Record", message = "Are you sure you want to delete this?" }) {
  if (!isOpen) return null;

  return createPortal(
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel" style={{ maxWidth: '400px', height: 'auto', maxHeight: 'fit-content', borderRadius: '12px' }}>
        <div className="modal-header" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e0e0ea', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem', color: '#1e293b' }}>
            <Trash2 size={20} style={{ color: '#dc2626' }} />
            {title}
          </h2>
          <button className="modal-close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: '#94a3b8' }}>×</button>
        </div>
        <div className="modal-body" style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '1.05rem', color: '#334155', margin: 0 }}>
            {message}
          </p>
        </div>
        <div className="modal-footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e0e0ea', display: 'flex', justifyContent: 'center', gap: '1rem', background: '#f8fafc', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '0.5rem 1.5rem' }}>Cancel</button>
          <button className="btn-primary" style={{ backgroundColor: '#dc2626', borderColor: '#dc2626', padding: '0.5rem 1.5rem' }} onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
