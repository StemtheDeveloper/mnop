import React from 'react';
import { useUser } from '../context/UserContext';
import DataFixerTool from '../components/admin/DataFixerTool';


const AdminDataFixerPage = () => {
    const { userRole, hasRole } = useUser();
    const isAdmin = hasRole('admin');

    // If user is not an admin, show access denied message
    if (!isAdmin) {
        return (
            <div className="admin-tools-page">
                <div className="access-denied">
                    <h1>Access Denied</h1>
                    <p>You need administrator privileges to access this page.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-tools-page">
            <h1>Admin Data Management</h1>

            <div className="admin-tools-section">
                <DataFixerTool />
            </div>

            {/* If we want to add instructions or help info */}
            <div className="admin-help-section">
                <h3>How to Fix Category Issues</h3>
                <ol>
                    <li>Select "products" as the data type</li>
                    <li>Optionally filter by category name using the Query Field (set to "category") and Query Value</li>
                    <li>Click "Load Data" to retrieve products</li>
                    <li>Select a product from the list to view its details</li>
                    <li>Click "Edit This Item" to modify the product</li>
                    <li>Ensure the "categories" field is an array containing category names</li>
                    <li>If needed, add or remove categories from the array</li>
                    <li>Click "Save Changes" to update the product in the database</li>
                </ol>
                <p className="important-note">
                    <strong>Important:</strong> The "categories" field should be an array, even if there's only one category.
                    Products with missing or incorrect "categories" arrays will not appear in category filters.
                </p>
            </div>
        </div>
    );
};

export default AdminDataFixerPage;