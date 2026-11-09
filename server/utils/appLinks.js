// In-app routes that notifications point to. Keep these in step with the client routes.
export const homeLink = () => '/home';
export const peopleLink = () => '/people';
export const friendsLink = () => '/people/friends';
export const groupLink = (id) => `/people/groups/${id}`;
export const timetableLink = (id) => `/plan?timetable=${id}`;
export const taskLink = (id) => `/plan?view=tasks&task=${id}`;
