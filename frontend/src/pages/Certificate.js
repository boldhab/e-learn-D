import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { learningAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Certificate = () => {
  const { courseId } = useParams();
  const { user } = useAuth();
  const [certificate, setCertificate] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCertificate = async () => {
      if (!user) return;

      try {
        const res = await learningAPI.getCertificate(user.id, courseId);
        setCertificate(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Certificate is not available yet');
      } finally {
        setLoading(false);
      }
    };

    loadCertificate();
  }, [courseId, user]);

  const downloadCertificate = async () => {
    try {
      const res = await learningAPI.downloadCertificate(user.id, courseId);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `certificate-${courseId}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to download certificate');
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span>Loading certificate...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrapper">
        <div className="empty-state">
          <h3>Certificate locked</h3>
          <p>{error}</p>
          <Link to={`/course/${courseId}`} className="btn btn-ghost" style={{ marginTop:'1rem' }}>Back to course</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper animate-fadeUp">
      <Link to={`/course/${courseId}`} className="nav-link" style={{ display:'inline-flex', marginBottom:'1.5rem' }}>
        Back to course
      </Link>

      <div className="certificate-card">
        <div className="certificate-kicker">Certificate of Completion</div>
        <h1>{certificate.student_name}</h1>
        <p>has successfully completed</p>
        <h2>{certificate.course_title}</h2>
        <div className="certificate-meta">
          Issued {new Date(certificate.issued_at).toLocaleDateString()} · ID {certificate.certificate_code}
        </div>
        <button type="button" className="btn btn-primary" onClick={downloadCertificate}>
          Download PDF
        </button>
      </div>
    </div>
  );
};

export default Certificate;
