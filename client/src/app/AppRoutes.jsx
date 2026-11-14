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
import RedirectTo from "./RedirectTo";
import usePageTitle from "./usePageTitle";

const LegalPage = lazy(() => import("@/features/legal/LegalPage"));
const HomePage = lazy(() => import("@/features/home/HomePage"));
const PlanPage = lazy(() => import("@/features/plan/PlanPage"));
const StudyPage = lazy(() => import("@/features/study/StudyPage"));
const FilesPage = lazy(() => import("@/features/files/FilesPage"));
const SubjectPage = lazy(() => import("@/features/study/SubjectPage"));
const ReviewerPage = lazy(() => import("@/features/study/ReviewerPage"));
const DeckPage = lazy(() => import("@/features/flashcards/DeckPage"));
const FlashcardReviewPage = lazy(() => import("@/features/flashcards/FlashcardReviewPage"));
const PracticePage =lazy(() => import("@/features/practice/PracticePage"));
const PeoplePage = lazy(() => import("@/features/people/PeoplePage"));
const ProfilePage = lazy(() => import("@/features/people/ProfilePage"));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"));
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

// Each signed-in page that is still unbuilt is a titled placeholder inside the shell until its own
// batch replaces it with a lazy-loaded page. Focus screens have no shell.
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
          <Route path="/study" element={<StudyPage />} />
          <Route path="/study/subjects/:subjectId" element={<SubjectPage />} />
          <Route path="/study/practice" element={<StudyPage />} />
          <Route path="/study/files/*" element={<FilesPage />} />
          <Route path="/files" element={<RedirectTo to="/study/files" />} />
          <Route path="/study/reviewers" element={<RedirectTo to="/study/practice" />} />
          <Route path="/study/flashcards" element={<RedirectTo to="/study/practice" set={{ show: "flashcards" }} />} />
          <Route path="/study/flashcards/:deckId" element={<DeckPage />} />
          <Route path="/study/reviewers/:reviewerId" element={<ReviewerPage />} />
          <Route path="/wellbeing" element={<WellbeingPage />} />
          <Route path="/people" element={<PeoplePage />} />
          <Route path="/people/groups/:groupId" element={<PeoplePage />} />
          <Route path="/people/friends" element={<PeoplePage tab="friends" />} />
          <Route path="/people/:userId" element={<ProfilePage />} />
          <Route path="/profile" element={<PlaceholderPage title="Profile" heading="We're redrawing this part" shell />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/:section" element={<SettingsPage />} />
          <Route path="/me" element={<RedirectTo to="/profile" />} />
          <Route path="/me/profile" element={<RedirectTo to="/profile" />} />
          <Route path="/me/settings" element={<RedirectTo to="/settings" />} />
          <Route path="/me/account" element={<RedirectTo to="/settings/account" />} />
          <Route path="/me/privacy" element={<RedirectTo to="/settings/privacy" />} />
          <Route path="/me/help" element={<RedirectTo to="/settings/help" />} />
          <Route path="/whats-new" element={<RedirectTo to="/settings/whats-new" />} />
          <Route path="/notifications" element={placeholder("Notifications")} />
        </Route>
        <Route element={<FocusLayout />}>
          <Route path="/study/reviewers/:reviewerId/practice" element={<PracticePage />} />
          <Route path="/study/flashcards/review" element={<FlashcardReviewPage />} />
          <Route path="/wellbeing/check-in/:kind" element={<CheckInPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
