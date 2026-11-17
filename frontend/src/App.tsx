import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";

const Fleet = lazy(() => import("./pages/Fleet"));
const CarDetail = lazy(() => import("./pages/CarDetail"));
const BookingPage = lazy(() => import("./pages/Booking"));
const Account = lazy(() => import("./pages/Account"));
const MyBookings = lazy(() => import("./pages/MyBookings"));
const Admin = lazy(() => import("./pages/Admin"));
const Contact = lazy(() => import("./pages/Contact"));
const NotFound = lazy(() => import("./pages/NotFound"));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!location.hash) window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const Loading = () => (
  <div className="grid min-h-[50vh] place-items-center text-muted" role="status">
    Yüklənir…
  </div>
);

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route element={<Layout />}>
            <Route path="/park" element={<Fleet />} />
            <Route path="/park/:id" element={<CarDetail />} />
            <Route path="/rezervasiya" element={<BookingPage />} />
            <Route path="/daxil-ol" element={<Account />} />
            <Route path="/hesab" element={<MyBookings />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/elaqe" element={<Contact />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
