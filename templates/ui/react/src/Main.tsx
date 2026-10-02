import { Route, Routes } from "react-router";
import { StatusPage } from "./pages/StatusPage";

// core-ui mounts this component at `/<path>/*`; routes below are relative to it.
// It resolves the component by the PascalCase expose name.
export const __Pascal__ = () => (
  <Routes>
    <Route index element={<StatusPage />} />
  </Routes>
);
