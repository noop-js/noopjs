// client: resume
import { signal } from '@noopjs/signals';

export default function FeedbackForm() {
  const name = signal('');
  const email = signal('');
  const rating = signal(5);
  const category = signal('bug');
  const message = signal('');

  return (
    <div>
      <h1>Feedback Form</h1>
      <p>Name: {name}</p>
      <p>Email: {email}</p>
      <p>Rating: {rating}</p>
      <p>Message: {message}</p>
      <form>
        <div>
          <label>Name</label>
          <input value={name} onInput={(e: Event) => name.set((e.target as HTMLInputElement).value)} />
        </div>
        <div>
          <label>Email</label>
          <input value={email} onInput={(e: Event) => email.set((e.target as HTMLInputElement).value)} />
        </div>
        <div>
          <label>Rating</label>
          <input type="number" value={rating} onInput={(e: Event) => rating.set(Number((e.target as HTMLInputElement).value))} />
        </div>
        <div>
          <label>Category</label>
          <select value={category} onChange={(e: Event) => category.set((e.target as HTMLSelectElement).value)}>
            <option value="bug">Bug</option>
            <option value="feature">Feature</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label>Message</label>
          <textarea value={message} onInput={(e: Event) => message.set((e.target as HTMLTextAreaElement).value)} />
        </div>
      </form>
    </div>
  );
}
