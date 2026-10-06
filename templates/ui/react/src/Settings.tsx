import "./styles.css";
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";

const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);

// core-ui mounts this component at `/settings/<path>/*`; it resolves the
// `<name>Settings` expose by PascalCase.
export const __Pascal__Settings = () => (
  <Suspense fallback={<div />}>
    <Routes>
      <Route index element={<SettingsPage />} />
    </Routes>
  </Suspense>
);
