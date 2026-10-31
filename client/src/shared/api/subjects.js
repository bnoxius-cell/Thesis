import { get } from "./http";

export const fetchSubjects = () => get("/api/subjects");
