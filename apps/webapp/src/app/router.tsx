import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './layout/AppShell.js';
import { LibraryPage } from '../pages/LibraryPage.js';
import { LearnPage } from '../pages/LearnPage.js';
import { AccountPage } from '../pages/AccountPage.js';
import { CourseDetailPage } from '../pages/CourseDetailPage.js';
import { LessonPage } from '../pages/LessonPage.js';
import { UpdatePage } from '../pages/UpdatePage.js';
import { SettingsPage } from '../pages/SettingsPage.js';
import { CreatorOnboardingPage } from '../pages/CreatorOnboardingPage.js';
import { NotFoundPage } from '../pages/NotFoundPage.js';
import { UiPreviewPage } from '../pages/UiPreviewPage.js';
import { ExpertHomePage } from '../pages/ExpertHomePage.js';
import { ExpertTeamPage } from '../pages/ExpertTeamPage.js';
import { ExpertCoursesPage } from '../pages/ExpertCoursesPage.js';
import { ExpertCourseEditorPage } from '../pages/ExpertCourseEditorPage.js';
import { ExpertCourseAccessPage } from '../pages/ExpertCourseAccessPage.js';
import { ExpertCourseModulesPage } from '../pages/ExpertCourseModulesPage.js';
import { ExpertModuleLessonsPage } from '../pages/ExpertModuleLessonsPage.js';
import { ExpertLessonEditorPage } from '../pages/ExpertLessonEditorPage.js';
import { ExpertLessonSubmissionsPage } from '../pages/ExpertLessonSubmissionsPage.js';
import { CatalogPage } from '../pages/CatalogPage.js';
import { CatalogCoursePage } from '../pages/CatalogCoursePage.js';
import { InviteActivatePage } from '../pages/InviteActivatePage.js';
import { MyOrdersPage } from '../pages/MyOrdersPage.js';
import { PartnerPayoutsPage } from '../pages/PartnerPayoutsPage.js';
import { AdminPaymentsPage } from '../pages/AdminPaymentsPage.js';
import { AdminExpertsPage } from '../pages/AdminExpertsPage.js';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/learn" replace /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'invite/:code', element: <InviteActivatePage /> },
      { path: 'catalog', element: <CatalogPage /> },
      { path: 'catalog/course/:id', element: <CatalogCoursePage /> },
      { path: 'learn', element: <LearnPage /> },
      { path: 'account', element: <AccountPage /> },
      { path: 'account/orders', element: <MyOrdersPage /> },
      { path: 'account/partner-payouts', element: <PartnerPayoutsPage /> },
      { path: 'admin/payments', element: <AdminPaymentsPage /> },
      { path: 'admin/experts', element: <AdminExpertsPage /> },
      { path: 'course/:id', element: <CourseDetailPage /> },
      { path: 'lesson/:lessonId', element: <LessonPage /> },
      { path: 'update/:id', element: <UpdatePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'creator/onboarding', element: <CreatorOnboardingPage /> },
      { path: 'expert', element: <ExpertHomePage /> },
      { path: 'expert/:expertId/team', element: <ExpertTeamPage /> },
      { path: 'expert/:expertId/courses', element: <ExpertCoursesPage /> },
      { path: 'expert/:expertId/courses/:courseId', element: <ExpertCourseEditorPage /> },
      { path: 'expert/:expertId/courses/:courseId/access', element: <ExpertCourseAccessPage /> },
      { path: 'expert/:expertId/courses/:courseId/modules', element: <ExpertCourseModulesPage /> },
      { path: 'expert/:expertId/modules/:moduleId/lessons', element: <ExpertModuleLessonsPage /> },
      { path: 'expert/:expertId/modules/:moduleId/lessons/:lessonId', element: <ExpertLessonEditorPage /> },
      { path: 'expert/:expertId/lessons/:lessonId/submissions', element: <ExpertLessonSubmissionsPage /> },
      { path: 'ui-preview', element: <UiPreviewPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
