import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AuthPage from "@/pages/authentication/AuthPage";
import { useAuth } from "@/pages/authentication/AuthContext";
import AppLayout from "./AppLayout";
import FocusLayout from "./FocusLayout";
import PublicLayout from "./PublicLayout";
import RequireAuth from "./RequireAuth";
import NotFound from "./NotFound";
import PlaceholderPage from "./PlaceholderPage";
import usePageTitle from "./usePageTitle";

const LegalPage = lazy(() => import("@/features/legal/LegalPage"));
const HomePage = lazy(() => import("@/features/home/HomePage"));
const PlanPage = lazy(() => import("@/features/plan/PlanPage"));
const WellbeingPage = lazy(() => import("@/features/wellbeing/WellbeingPage"));
const CheckInPage = lazy(() => import("@/features/checkin/CheckInPage"));
// Development-only specimen of the shared primitives.
const UiSpecimen = import.meta.env.DEV ? lazy(() => import("./dev/UiSpecimen")) : null;

// Sign-in for visitors. A signed-in student goes on to the page they first asked for, or Home.
function SignInRoute() {
  const { isLoggedin } = useAuth();
  const from = useLocation().state?.from;
  usePageTitle("Sign in");
  if (isLoggedin) return <Navigate to={typeof from === "string" ? from : "/home"} replace />;
  return <AuthPage />;
}

// Each signed-in page is a titled placeholder inside the shell until its own batch replaces it
// with a lazy-loaded page. The focus screens (Practice, Check-in) have no shell, so they stay bare.
const placeholder = (title) => <PlaceholderPage title={title} shell />;
const barePlaceholder = (title) => <PlaceholderPage title={title} />;

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<SignInRoute />} />
      {UiSpecimen && (
        <Route path="/dev/ui" element={<Suspense fallback={null}><UiSpecimen /></Suspense>} />
      )}

      <Route element={<PublicLayout />}>
        <Route path="/terms-of-service" element={<LegalPage kind="terms" />} />
        <Route path="/privacy-policy" element={<LegalPage kind="privacy" />} />
        <Route path="/about" element={barePlaceholder("About")} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/study" element={placeholder("Study")} />
          <Route path="/study/subjects/:subjectId" element={placeholder("Subject")} />
          <Route path="/study/reviewers/:reviewerId" element={placeholder("Reviewer")} />
          <Route path="/wellbeing" element={<WellbeingPage />} />
          <Route path="/people" element={placeholder("People")} />
          <Route path="/people/groups/:groupId" element={placeholder("People")} />
          <Route path="/people/friends" element={placeholder("Friends")} />
          <Route path="/people/:userId" element={placeholder("Student profile")} />
          <Route path="/me" element={placeholder("Profile and settings")} />
          <Route path="/me/:section" element={placeholder("Profile and settings")} />
          <Route path="/notifications" element={placeholder("Notifications")} />
        </Route>
        <Route element={<FocusLayout />}>
          <Route path="/study/reviewers/:reviewerId/practice" element={barePlaceholder("Practice")} />
          <Route path="/wellbeing/check-in/:kind" element={<CheckInPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
