import "./item-detail.css";

// The title of a row that opens the details window. Its ::after covers the whole row (item-detail.css), so
// the entire row is the target; the done box and Join sit above it and keep their own clicks. Put it inside
// the row's title element and give the row `item-row`.
export default function ItemOpenButton({ onClick, children, ...rest }) {
  return (
    <button type="button" className="item-open" aria-haspopup="dialog" onClick={onClick} {...rest}>
      {children}
    </button>
  );
}
