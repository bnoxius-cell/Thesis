import { useState } from "react";
import useSeenOnce from "@/shared/hooks/useSeenOnce";
import { fileKind } from "./fileKinds";
import useFileImage from "./useFileImage";

// The 40px leading box of a photo row. The kind's image icon is always there; the preview is asked
// for once the row is near the screen and fades in over it when it has loaded. A photo without a
// preview, or whose preview won't load, keeps the icon.
export default function FileThumb({ file }) {
  const { Icon } = fileKind(file.ext);
  const [ref, seen] = useSeenOnce();
  const [loaded, setLoaded] = useState(false);
  const { src, onError } = useFileImage(file.id, "thumb", seen && file.hasThumb);

  return (
    <span ref={ref} className="files-thumb" aria-hidden="true">
      <Icon size={20} />
      {src && (
        <img
          src={src}
          alt=""
          width="40"
          height="40"
          className={loaded ? "is-loaded" : undefined}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            onError();
          }}
        />
      )}
    </span>
  );
}
