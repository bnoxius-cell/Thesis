// A place is where a file lives: "general", "subject:<id>" or "folder:<id>" (the server's own
// format). These helpers turn a file's `location` ({ type, id? }) and the lists the server sends
// (`locations.subjects`, `locations.folders`) into what the Files page shows. All pure.

export const GENERAL = "general";

export const placeOf = ({ type, id }) => (type === "general" ? GENERAL : `${type}:${id}`);

// What a chip or a tile calls a place. A subject missing from the active list is an archived one:
// deleting a subject moves its files to General, so nothing else can leave a file pointing at it.
export function placeName(location, locations) {
  if (location.type === "general") return "General";
  const list = location.type === "subject" ? locations.subjects : locations.folders;
  const found = list.find((place) => place.id === location.id);
  if (found) return found.name;
  return location.type === "subject" ? "Archived subject" : "Folder";
}

// How many files each place holds: { [place]: count }.
export function countByPlace(files) {
  const counts = {};
  for (const file of files) {
    const place = placeOf(file.location);
    counts[place] = (counts[place] ?? 0) + 1;
  }
  return counts;
}

export const filesIn = (files, place) => files.filter((file) => placeOf(file.location) === place);

// Files whose name contains `query`, ignoring case and the spaces around it. An empty query is no search.
export function matchName(files, query) {
  const needle = query.trim().toLowerCase();
  return needle ? files.filter((file) => file.name.toLowerCase().includes(needle)) : files;
}

// Every place a file can be put, in the order the page shows them: General, subjects in their order,
// then folders by name. Archived subjects aren't in `locations`, so they can't be picked.
export function placeOptions(locations) {
  return [
    { value: GENERAL, label: "General" },
    ...locations.subjects.map(({ id, name, color }) => ({ value: `subject:${id}`, label: name, color })),
    ...locations.folders.map(({ id, name }) => ({ value: `folder:${id}`, label: name })),
  ];
}
