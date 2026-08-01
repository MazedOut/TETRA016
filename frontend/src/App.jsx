import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import ExceptionQueue from "./pages/ExceptionQueue.jsx";
import InvoiceDetail from "./pages/InvoiceDetail.jsx";
import UploadBatch from "./pages/UploadBatch.jsx";
import Reports from "./pages/Reports.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/exceptions" element={<ExceptionQueue />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/upload" element={<UploadBatch />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </BrowserRouter>
  );
}
