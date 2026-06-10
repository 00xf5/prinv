/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Layout } from "./components/Layout";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Auth } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { History } from "./pages/History";
import { Home } from "./pages/Home";
import { BuyNumber } from "./pages/BuyNumber";
import { Inbox } from "./pages/Inbox";
import { Billing } from "./pages/Billing";
import { AdminLogin } from "./pages/admin/AdminLogin";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminUsers } from "./pages/admin/AdminUsers";
import { AdminSettings } from "./pages/admin/AdminSettings";
import { Toaster } from "@/components/ui/sonner";

export default function App() {
  return (
    <BrowserRouter>
        <Routes>
          {/* Main User App with standard Layout */}
          <Route path="/" element={<Layout><Home /></Layout>} />
          <Route path="/auth" element={<Layout><Auth /></Layout>} />
          <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
          <Route path="/buy" element={<Layout><BuyNumber /></Layout>} />
          <Route path="/inbox" element={<Layout><Inbox /></Layout>} />
          <Route path="/history" element={<Layout><History /></Layout>} />
          <Route path="/billing" element={<Layout><Billing /></Layout>} />
          
          {/* Admin Routes with distinct AdminLayout */}
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/*" element={<AdminLayout />}>
             <Route path="dashboard" element={<AdminDashboard />} />
             <Route path="users" element={<AdminUsers />} />
             <Route path="settings" element={<AdminSettings />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      <Toaster />
    </BrowserRouter>
  );
}
