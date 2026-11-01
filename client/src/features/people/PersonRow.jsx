import { Link } from "react-router-dom";
import PeopleAvatar from "./PeopleAvatar";
import "./people-shared.css";

// One person (or group) in a list: the picture and name open `to`, `children` are the buttons or
// chip at the end of the row. `line` is the quiet text under the name.
export default function PersonRow({ to, name, picture, line, children }) {
  return (
    <li className="people-person">
      <Link to={to} className="people-person__who">
        <PeopleAvatar name={name} src={picture} className="people-person__avatar" />
        <span className="people-person__text">
          <span className="people-person__name">{name}</span>
          {line && <span className="people-person__line">{line}</span>}
        </span>
      </Link>
      {children && <div className="people-person__end">{children}</div>}
    </li>
  );
}
