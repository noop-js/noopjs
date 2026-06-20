function renderChildren(children: any[] | undefined) {
  if (!children || children.length === 0) return null;
  var frag = document.createDocumentFragment();
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    var el = document.createElement('div');
    if (child.deleted || child.dead) {
      el.className = 'comment';
      el.innerHTML = '<div class="comment-header">[deleted]</div>';
      frag.appendChild(el);
    } else {
      el.className = 'comment';
      var header = document.createElement('div');
      header.className = 'comment-header';
      var authorLink = document.createElement('a');
      authorLink.href = '/user/' + child.author;
      authorLink.textContent = child.author;
      header.appendChild(authorLink);
      header.appendChild(document.createTextNode(' ' + (child.points > 0 ? String(child.points) + ' points' : '')));
      el.appendChild(header);
      if (child.text) {
        var body = document.createElement('div');
        body.className = 'comment-body';
        body.innerHTML = child.text;
        el.appendChild(body);
      }
      if (child.children && child.children.length > 0) {
        var nested = renderChildren(child.children);
        if (nested) {
          var wrapper = document.createElement('div');
          wrapper.className = 'comment-nested';
          wrapper.appendChild(nested);
          el.appendChild(wrapper);
        }
      }
      frag.appendChild(el);
    }
  }
  return frag;
}

export default function Comment(props: { comment: any }) {
  return renderChildren(props.comment.children);
}
