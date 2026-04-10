import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
} from '../shared/ui/index.js';

export function UpdatePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Card>
        <CardHeader>
          <CardTitle>Обновление #{id}</CardTitle>
          <CardDescription>Новость/обновление в разработке</CardDescription>
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
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Назад
            </Button>
            <Button variant="primary" onClick={() => navigate('/library')}>
              К библиотеке
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
