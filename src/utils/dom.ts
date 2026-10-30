// inspired by https://github.com/zurb/tribute/blob/master/src/TributeRange.js#L446-L556
export const getCoords = (t: HTMLTextAreaElement) => {
  let properties = [
    "direction",
    "boxSizing",
    "width",
    "height",
    "overflowX",
    "overflowY",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "fontStyle",
    "fontVariant",
    "fontWeight",
    "fontStretch",
    "fontSize",
    "fontSizeAdjust",
    "lineHeight",
    "fontFamily",
    "textAlign",
    "textTransform",
    "textIndent",
    "textDecoration",
    "letterSpacing",
    "wordSpacing",
  ] as const;

  // the textarea's own document and window: Roam's editor can render in a second one (the desktop
  // Sidecar)
  const doc = t.ownerDocument;
  const win = doc.defaultView || window;
  const div = doc.createElement("div");
  div.id = "input-textarea-caret-position-mirror-div";
  doc.body.appendChild(div);

  const style = div.style;
  const computed = win.getComputedStyle(t);

  style.whiteSpace = "pre-wrap";
  style.wordWrap = "break-word";

  // position off-screen
  style.position = "absolute";
  style.visibility = "hidden";
  style.overflow = "hidden";

  // transfer the element's properties to the div
  properties.forEach((prop) => {
    style[prop] = computed[prop];
  });

  div.textContent = t.value.substring(0, t.selectionStart);

  const span = doc.createElement("span");
  span.textContent = t.value.substring(t.selectionStart) || ".";
  div.appendChild(span);

  const html = doc.documentElement;
  const windowLeft =
    (win.pageXOffset || html.scrollLeft) - (html.clientLeft || 0);
  const windowTop = (win.pageYOffset || html.scrollTop) - (html.clientTop || 0);

  const coordinates = {
    top:
      windowTop +
      span.offsetTop +
      parseInt(computed.borderTopWidth) +
      parseInt(computed.fontSize) -
      t.scrollTop -
      9,
    left: windowLeft + span.offsetLeft + parseInt(computed.borderLeftWidth) - 1,
  };
  doc.body.removeChild(div);
  return coordinates;
};
