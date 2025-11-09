import { useState, useEffect } from 'react';

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard', { credentials: 'include' });

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const dashboardData = await response.json();
      setData(dashboardData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount, currency = 'USD') => {
    if (!amount) return '-';
    const symbol = currency === 'USD' ? '$' : currency === 'AUD' ? 'A$' : 'S$';
    return `${symbol}${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatHours = (hours) => {
    if (!hours) return '0';
    return parseFloat(hours).toFixed(1);
  };

  const formatMonth = (monthStr) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="alert alert-error">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { counts, pricingSummary, pricingByAccount, pricingByProduct, pricingByUser, resourceHours, topAccounts, timeline, engagementTypes } = data;

  // Calculate total resource hours
  const totalResourceHours =
    (parseFloat(resourceHours.pm_hours) || 0) +
    (parseFloat(resourceHours.ic_hours) || 0) +
    (parseFloat(resourceHours.sa_hours) || 0) +
    (parseFloat(resourceHours.se_hours) || 0) +
    (parseFloat(resourceHours.trainer_hours) || 0) +
    (parseFloat(resourceHours.integration_hours) || 0) +
    (parseFloat(resourceHours.apac_testing_hours) || 0) +
    (parseFloat(resourceHours.apac_rd_hours) || 0);

  // Prepare resource hours data for visualization
  const resourceData = [
    { role: 'PM', hours: parseFloat(resourceHours.pm_hours) || 0 },
    { role: 'IC', hours: parseFloat(resourceHours.ic_hours) || 0 },
    { role: 'SA', hours: parseFloat(resourceHours.sa_hours) || 0 },
    { role: 'SE', hours: parseFloat(resourceHours.se_hours) || 0 },
    { role: 'Trainer', hours: parseFloat(resourceHours.trainer_hours) || 0 },
    { role: 'Integration', hours: parseFloat(resourceHours.integration_hours) || 0 },
    { role: 'APAC Test', hours: parseFloat(resourceHours.apac_testing_hours) || 0 },
    { role: 'APAC R&D', hours: parseFloat(resourceHours.apac_rd_hours) || 0 },
  ].filter(item => item.hours > 0);

  return (
    <div className="container">
      <div className="header">
        <div className="header-content">
          <h1>Dashboard</h1>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="dashboard-card">
          <div className="dashboard-card-title">Generated SOWs</div>
          <div className="dashboard-card-value">{counts.total_generated_sows}</div>
          <div className="dashboard-card-subtitle">AI-generated documents</div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-title">Uploaded SOWs</div>
          <div className="dashboard-card-value">{counts.total_uploaded_sows}</div>
          <div className="dashboard-card-subtitle">Active in knowledge bank</div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-title">Accounts</div>
          <div className="dashboard-card-value">{counts.total_accounts}</div>
          <div className="dashboard-card-subtitle">Total clients</div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-title">Active Users</div>
          <div className="dashboard-card-value">{counts.total_users}</div>
          <div className="dashboard-card-subtitle">System users</div>
        </div>
      </div>

      {/* Pricing Summary */}
      {pricingSummary && pricingSummary.length > 0 && (
        <div className="dashboard-section">
          <h2>Pricing Summary</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {pricingSummary.map((item, idx) => (
              <div key={idx} className="dashboard-card">
                <div className="dashboard-card-title">{item.currency} Totals</div>
                <div className="dashboard-card-value">{formatCurrency(item.total, item.currency)}</div>
                <div className="dashboard-card-subtitle">
                  {item.count} SOWs | Avg: {formatCurrency(item.average, item.currency)}
                </div>
                <div className="dashboard-card-detail">
                  Range: {formatCurrency(item.minimum, item.currency)} - {formatCurrency(item.maximum, item.currency)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline Chart */}
      {timeline && timeline.length > 0 && (
        <div className="dashboard-section">
          <h2>SOW Creation Timeline (Last 12 Months)</h2>
          <div className="timeline-chart">
            {timeline.map((item, idx) => (
              <div key={idx} className="timeline-item">
                <div className="timeline-label">{formatMonth(item.month)}</div>
                <div className="timeline-bars">
                  <div className="timeline-bar-container">
                    <div
                      className="timeline-bar generated"
                      style={{ height: `${Math.max(item.generated * 10, 5)}px` }}
                      title={`Generated: ${item.generated}`}
                    ></div>
                    <div className="timeline-count">{item.generated}</div>
                  </div>
                  <div className="timeline-bar-container">
                    <div
                      className="timeline-bar uploaded"
                      style={{ height: `${Math.max(item.uploaded * 10, 5)}px` }}
                      title={`Uploaded: ${item.uploaded}`}
                    ></div>
                    <div className="timeline-count">{item.uploaded}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="timeline-legend">
            <div><span className="legend-box generated"></span> Generated</div>
            <div><span className="legend-box uploaded"></span> Uploaded</div>
          </div>
        </div>
      )}

      {/* Resource Hours Breakdown */}
      {resourceData.length > 0 && (
        <div className="dashboard-section">
          <h2>Resource Hours Breakdown</h2>
          <div className="resource-chart">
            {resourceData.map((item, idx) => {
              const percentage = (item.hours / totalResourceHours) * 100;
              return (
                <div key={idx} className="resource-item">
                  <div className="resource-label">{item.role}</div>
                  <div className="resource-bar-container">
                    <div
                      className="resource-bar"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <div className="resource-value">{formatHours(item.hours)}h ({percentage.toFixed(1)}%)</div>
                </div>
              );
            })}
          </div>
          <div className="resource-total">Total Hours: {formatHours(totalResourceHours)}h</div>
        </div>
      )}

      {/* Top Accounts by SOW Count */}
      {topAccounts && topAccounts.length > 0 && (
        <div className="dashboard-section">
          <h2>Top Accounts by SOW Count</h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Account Name</th>
                  <th>Total SOWs</th>
                  <th>Active SOWs</th>
                </tr>
              </thead>
              <tbody>
                {topAccounts.map((account, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>{account.account_name}</td>
                    <td>{account.sow_count}</td>
                    <td>{account.active_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pricing by Account */}
      {pricingByAccount && pricingByAccount.length > 0 && (
        <div className="dashboard-section">
          <h2>Top 10 Accounts by Pricing</h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Account Name</th>
                  <th>Currency</th>
                  <th>SOW Count</th>
                  <th>Total Pricing</th>
                </tr>
              </thead>
              <tbody>
                {pricingByAccount.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.account_name}</td>
                    <td>{item.currency}</td>
                    <td>{item.sow_count}</td>
                    <td>{formatCurrency(item.total_pricing, item.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pricing by Product */}
      {pricingByProduct && pricingByProduct.length > 0 && (
        <div className="dashboard-section">
          <h2>Pricing by Product</h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Currency</th>
                  <th>SOW Count</th>
                  <th>Total Pricing</th>
                </tr>
              </thead>
              <tbody>
                {pricingByProduct.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.product_name}</td>
                    <td>{item.currency}</td>
                    <td>{item.sow_count}</td>
                    <td>{formatCurrency(item.total_pricing, item.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pricing by User */}
      {pricingByUser && pricingByUser.length > 0 && (
        <div className="dashboard-section">
          <h2>Pricing by User</h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>User Name</th>
                  <th>Currency</th>
                  <th>SOW Count</th>
                  <th>Total Pricing</th>
                </tr>
              </thead>
              <tbody>
                {pricingByUser.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.user_name}</td>
                    <td>{item.currency}</td>
                    <td>{item.sow_count}</td>
                    <td>{formatCurrency(item.total_pricing, item.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Engagement Type Distribution */}
      {engagementTypes && engagementTypes.length > 0 && (
        <div className="dashboard-section">
          <h2>Engagement Type Distribution</h2>
          <div className="engagement-chart">
            {engagementTypes.map((item, idx) => {
              const total = engagementTypes.reduce((sum, e) => sum + e.count, 0);
              const percentage = (item.count / total) * 100;
              return (
                <div key={idx} className="engagement-item">
                  <div className="engagement-label">{item.engagement_type}</div>
                  <div className="engagement-bar-container">
                    <div
                      className="engagement-bar"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <div className="engagement-value">{item.count} ({percentage.toFixed(1)}%)</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
