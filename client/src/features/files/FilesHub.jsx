import { useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui";
import FileSearch from "./FileSearch";
import FilesDrop from "./FilesDrop";
import FilesNotice from "./FilesNotice";
import FilesTabsRow from "./FilesTabsRow";
import LibraryFileList from "./LibraryFileList";
import LibraryStatus from "./LibraryStatus";
import PlaceTiles from "./PlaceTiles";
import StorageMeter from "./StorageMeter";
import UploadButton from "./UploadButton";
import { countByPlace, matchName, placeName } from "./places";

const RECENT = 8; // the newest uploads

const resultsText = (n) => `${n} ${n === 1 ? "result" : "results"}`;

function HubBody({ library, block, canUpload, phone, pickFiles, openFolderDialog }) {
  const [query, setQuery] = useState("");
  const { files, locations, usage } = library;
  const counts = useMemo(() => countByPlace(files), [files]);
  const searching = query.trim() !== "";
  const results = matchName(files, query);
  const where = (file) => placeName(file.location, locations);

  return (
    <>
      {block && <FilesNotice icon={block.icon}>{block.message}</FilesNotice>}
      <StorageMeter usage={usage} fileCount={files.length} />
      {files.length > 0 && <FileSearch value={query} onChange={setQuery} />}
      <div key={searching ? "results" : "browse"} className="files-content files-fade">
        {searching ? (
          <section className="files-section">
            <h2 className="files-eyebrow">{resultsText(results.length)}</h2>
            {results.length > 0 ? (
              <LibraryFileList library={library} files={results} placeName={where} />
            ) : (
              <div className="files-empty">
                <EmptyState
                  icon={Search}
                  title={`No files match "${query.trim()}"`}
                  actions={<Button variant="secondary" onClick={() => setQuery("")}>Clear search</Button>}
                >
                  Try another word from the file's name.
                </EmptyState>
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="files-section">
              <h2 className="files-eyebrow">Places</h2>
              <PlaceTiles locations={locations} counts={counts} onNewFolder={() => openFolderDialog("new")} />
            </section>
            <section className="files-section">
              <h2 className="files-eyebrow">Recent</h2>
              <FilesDrop onFiles={pickFiles} disabled={!canUpload}>
                {files.length > 0 ? (
                  <LibraryFileList library={library} files={files.slice(0, RECENT)} placeName={where} />
                ) : (
                  <div className="files-empty">
                    <EmptyState
                      icon={FileText}
                      title="No files yet"
                      actions={<UploadButton disabled={!canUpload} onFiles={pickFiles}>Upload a file</UploadButton>}
                    >
                      Upload notes, handouts or photos and keep them with the subject they belong to.
                    </EmptyState>
                  </div>
                )}
              </FilesDrop>
            </section>
          </>
        )}
      </div>
      {phone && files.length > 0 && <UploadButton floating disabled={!canUpload} onFiles={pickFiles} />}
      <p className="sr-only" role="status">{searching ? resultsText(results.length) : ""}</p>
    </>
  );
}

// The Files tab (Figma 150:924, phone 154:1404, search 151:1757, empty 160:2867): the storage meter,
// a search over every file, PLACES (General, subjects, folders, New folder) and the newest uploads.
// Searching swaps the places and recent files for the matches, each with the place it is in. The
// search runs in the browser over the loaded list. `library`, `block`, `canUpload`, `phone`,
// `pickFiles` and `openFolderDialog` come from FilesPage.
export default function FilesHub(props) {
  const { library, canUpload, phone, pickFiles } = props;
  return (
    <div className="files-page">
      <FilesTabsRow library={library}>
        {!phone && <UploadButton disabled={!canUpload} onFiles={pickFiles} />}
      </FilesTabsRow>
      <div role="tabpanel" id="study-panel" aria-labelledby="study-tab-files" className="files-content">
        <LibraryStatus library={library} />
        {library.status === "ready" && <HubBody {...props} />}
      </div>
    </div>
  );
}
