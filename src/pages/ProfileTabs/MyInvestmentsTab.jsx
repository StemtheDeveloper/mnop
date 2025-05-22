import React from 'react';
import { Link } from 'react-router-dom';

const MyInvestmentsTab = () => {
  return (<div className="settings-section">
    <h3>Your Investments</h3>
    <p>View and manage your investment portfolio.</p>
    <div className="section-actions">
      <Link to="/portfolio" className="btn-primary">
        Go to Portfolio
      </Link>
    </div>
  </div>);
};

export default MyInvestmentsTab;
