import "./styles.css";
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";

const IndexPage = lazy(() =>
  import("./pages/IndexPage").then((module) => ({
    default: module.IndexPage,
  })),
);

// core-ui mounts this component at `/<path>/*`; routes below are relative to
// it. It resolves the component by the PascalCase expose name.
export const __Pascal__ = () => (
  <Suspense fallback={<div />}>
    <Routes>
      <Route index element={<IndexPage />} />
    </Routes>
  </Suspense>
);
