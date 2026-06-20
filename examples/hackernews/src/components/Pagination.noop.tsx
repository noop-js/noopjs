export default function Pagination(props: { current: number; total: number; base: string }) {
  return <div class="paginate">
    {props.current > 0 ? <a href={props.base + '?page=' + String(props.current - 1)}>{'< prev'}</a> : null}
    <span>page {String(props.current + 1)} of {String(props.total || 1)}</span>
    {props.current + 1 < props.total ? <a href={props.base + '?page=' + String(props.current + 1)}>{'next >'}</a> : null}
  </div>;
}
