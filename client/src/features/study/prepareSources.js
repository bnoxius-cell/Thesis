import shrinkPhoto from "../files/shrinkPhoto.js";
import stripOfficeMedia from "../files/stripOfficeMedia.js";

// Makes each file picked for a reviewer as small as its text needs, one after another so only one is
// unpacked in memory at a time: Word and PowerPoint lose their pictures, big photos shrink, anything
// else stays as it is. The list comes back in the same order, so the size checks that follow
// (takeSources) see what will really be sent.
export default async function prepareSources(files) {
  const prepared = [];
  for (const file of files) prepared.push(await shrinkPhoto(await stripOfficeMedia(file)));
  return prepared;
}
