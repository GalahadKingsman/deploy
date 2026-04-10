import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
} from '../shared/ui/index.js';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Card>
        <CardHeader>
          <CardTitle>Страница не найдена</CardTitle>
          <CardDescription>Запрашиваемая страница не существует</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            style={{
              display: 'flex',
              gap: 'var(--sp-2)',
              flexWrap: 'wrap',
              marginTop: 'var(--sp-4)',
            }}
          >
            <Button variant="primary" onClick={() => navigate('/learn')}>
              На обучение
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
