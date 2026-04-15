import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../shared/ui/index.js';

export function SettingsPage() {
  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Card>
        <CardHeader>
          <CardTitle>Настройки</CardTitle>
          <CardDescription>Настройки будут доступны позже</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
