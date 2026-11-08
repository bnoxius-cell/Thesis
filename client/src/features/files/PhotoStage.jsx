import { useState } from "react";
import { Image as ImageIcon, ImageOff } from "lucide-react";
import { Button } from "@/shared/ui";
import useFileImage from "./useFileImage";

// The viewer's photo: a placeholder block while the picture comes from a fresh link, then a fade in.
// A failed load says why and offers another try.
export default function PhotoStage({ file }) {
  const [loaded, setLoaded] = useState(false);
  const { src, status, message, onError, retry } = useFileImage(file.id, "file");

  if (status === "failed") {
    return (
      <div className="files-preview__failed" role="alert">
        <ImageOff size={28} aria-hidden="true" />
        <p>{message || "Couldn't load this photo."}</p>
        <Button variant="secondary" size="sm" onClick={retry}>Try again</Button>
      </div>
    );
  }
  return (
    <>
      {!loaded && (
        <span className="files-preview__placeholder" aria-hidden="true">
          <ImageIcon size={32} />
        </span>
      )}
      {src && (
        <img
          src={src}
          alt={file.name}
          className={loaded ? "is-loaded" : undefined}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            onError();
          }}
        />
      )}
    </>
  );
}
