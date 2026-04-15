import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../shared/ui/index.js';

export function NotFoundPage() {
  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Card>
        <CardHeader>
          <CardTitle>Страница не найдена</CardTitle>
          <CardDescription>Запрашиваемая страница не существует</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
