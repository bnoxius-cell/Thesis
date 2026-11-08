import { useMemo, useState } from "react";
import { File, Layers } from "lucide-react";
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

function HubBody({ library, block, canUpload, phone, uploadStatus, openUpload, openFolderDialog }) {
  const [query, setQuery] = useState("");
  const { files, locations, usage } = library;
  const counts = useMemo(() => countByPlace(files), [files]);
  const searching = query.trim() !== "";
  const results = matchName(files, query);
  const where = (file) => placeName(file.location, locations);

  return (
    <>
      {block && <FilesNotice icon={block.icon}>{block.message}</FilesNotice>}
      {!(phone && searching) && <StorageMeter usage={usage} fileCount={files.length} />}
      {files.length > 0 && <FileSearch value={query} onChange={setQuery} />}
      <div key={searching ? "results" : "browse"} className="files-content files-fade">
        {searching ? (
          results.length > 0 ? (
            <section className="files-section">
              <h2 className="files-eyebrow">{resultsText(results.length)}</h2>
              <LibraryFileList library={library} files={results} placeName={where} />
            </section>
          ) : (
            <EmptyState
              className="files-noresult"
              icon={Layers}
              title={
                <>
                  No files match<span className="files-noresult__query">{` "${query.trim()}"`}</span>
                </>
              }
              actions={<Button variant="secondary" onClick={() => setQuery("")}>Clear search</Button>}
            >
              Check the spelling, or try part of the file name.
            </EmptyState>
          )
        ) : (
          <>
            <section className="files-section">
              <h2 className="files-eyebrow">Places</h2>
              <PlaceTiles locations={locations} counts={counts} onNewFolder={() => openFolderDialog("new")} />
            </section>
            <section className="files-section">
              <h2 className="files-eyebrow">Recent</h2>
              <FilesDrop onFiles={openUpload} disabled={!canUpload}>
                {files.length > 0 ? (
                  <LibraryFileList library={library} files={files.slice(0, RECENT)} placeName={where} />
                ) : (
                  <div className="files-empty">
                    <EmptyState
                      icon={File}
                      title="No files yet"
                      actions={<UploadButton disabled={!canUpload} onClick={() => openUpload()}>Upload a file</UploadButton>}
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
      {phone && files.length > 0 && <UploadButton floating status={uploadStatus} disabled={!canUpload} onClick={() => openUpload()} />}
      <p className="sr-only" role="status">{searching ? resultsText(results.length) : ""}</p>
    </>
  );
}

// The Files tab (Figma 150:924, phone 154:1404, search 151:1757 / 155:1394, no results 151:1998 /
// 155:1549, empty 160:2867 / 160:3115): the storage meter, a search over every file, PLACES (General,
// subjects, folders, New folder) and the newest uploads. Searching swaps the places and recent files
// for the matches, each with the place it is in; on a phone the meter steps aside too. The search
// runs in the browser over the loaded list. `library`, `block`, `canUpload`, `phone`,
// `openUpload` and `openFolderDialog` come from FilesPage.
export default function FilesHub(props) {
  const { library, canUpload, phone, uploadStatus, openUpload } = props;
  return (
    <div className="files-page">
      <FilesTabsRow library={library}>
        {!phone && <UploadButton status={uploadStatus} disabled={!canUpload} onClick={() => openUpload()} />}
      </FilesTabsRow>
      <div role="tabpanel" id="study-panel" aria-labelledby="study-tab-files" className="files-content">
        <LibraryStatus library={library} />
        {library.status === "ready" && <HubBody {...props} />}
      </div>
    </div>
  );
}
