import React, { useState } from 'react';
import { AppShell } from '../ui/shell/index.js';
import {
  Button,
  Card,
  Input,
  ListItem,
  SkeletonLine,
  SkeletonBlock,
  SkeletonCircle,
  EmptyState,
  ErrorState,
  toast,
  BottomSheet,
} from '../ui/kit/index.js';

export function UiPreviewPage() {
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState<string | undefined>();

  return (
    <AppShell
      title="Edify"
      logo={
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            backgroundColor: 'var(--color-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--color-bg-0)',
          }}
        >
          E
        </div>
      }
    >
      <div style={{ padding: 'var(--spacing-10, 16px)' }}>
        <h2 style={{ color: 'var(--color-text-0)', marginBottom: 'var(--spacing-10, 16px)' }}>
          UI Kit Preview
        </h2>

        {/* Buttons */}
        <section style={{ marginBottom: 'var(--spacing-12, 24px)' }}>
          <h3 style={{ color: 'var(--color-text-0)', marginBottom: 'var(--spacing-6, 8px)' }}>
            Buttons
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6, 8px)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-4, 6px)', flexWrap: 'wrap' }}>
              <Button variant="primary" size="sm">
                Primary SM
              </Button>
              <Button variant="primary" size="md">
                Primary MD
              </Button>
              <Button variant="primary" size="lg">
                Primary LG
              </Button>
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-4, 6px)', flexWrap: 'wrap' }}>
              <Button variant="secondary" size="md">
                Secondary
              </Button>
              <Button variant="ghost" size="md">
                Ghost
              </Button>
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-4, 6px)', flexWrap: 'wrap' }}>
              <Button variant="primary" loading>
                Loading
              </Button>
              <Button variant="primary" disabled>
                Disabled
              </Button>
            </div>
          </div>
        </section>

        {/* Cards */}
        <section style={{ marginBottom: 'var(--spacing-12, 24px)' }}>
          <h3 style={{ color: 'var(--color-text-0)', marginBottom: 'var(--spacing-6, 8px)' }}>
            Cards
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6, 8px)' }}>
            <Card variant="default">
              <div style={{ color: 'var(--color-text-0)' }}>Default Card</div>
            </Card>
            <Card variant="glass">
              <div style={{ color: 'var(--color-text-0)' }}>Glass Card</div>
            </Card>
          </div>
        </section>

        {/* Inputs */}
        <section style={{ marginBottom: 'var(--spacing-12, 24px)' }}>
          <h3 style={{ color: 'var(--color-text-0)', marginBottom: 'var(--spacing-6, 8px)' }}>
            Inputs
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6, 8px)' }}>
            <Input
              placeholder="Default input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <Input variant="search" placeholder="Поиск по курсам..." />
            <Input
              placeholder="Input with error"
              error={inputError}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setInputError(e.target.value.length < 3 ? 'Минимум 3 символа' : undefined);
              }}
            />
          </div>
        </section>

        {/* List Items */}
        <section style={{ marginBottom: 'var(--spacing-12, 24px)' }}>
          <h3 style={{ color: 'var(--color-text-0)', marginBottom: 'var(--spacing-6, 8px)' }}>
            List Items
          </h3>
          <Card variant="default" padding="sm" style={{ padding: 0 }}>
            <ListItem
              left={<SkeletonCircle size="32px" />}
              title="Item with subtitle"
              subtitle="Subtitle text"
              onClick={() => toast.info('Clicked!')}
            />
            <ListItem
              left="📚"
              title="Item with icon"
              right="→"
              onClick={() => toast.info('Clicked!')}
            />
            <ListItem title="Simple item" />
          </Card>
        </section>

        {/* Skeletons */}
        <section style={{ marginBottom: 'var(--spacing-12, 24px)' }}>
          <h3 style={{ color: 'var(--color-text-0)', marginBottom: 'var(--spacing-6, 8px)' }}>
            Skeletons
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6, 8px)' }}>
            <SkeletonLine width="100%" height="20px" />
            <SkeletonLine width="80%" height="16px" />
            <div style={{ display: 'flex', gap: 'var(--spacing-6, 8px)', alignItems: 'center' }}>
              <SkeletonCircle size="40px" />
              <div style={{ flex: 1 }}>
                <SkeletonLine width="100%" height="16px" />
                <SkeletonLine
                  width="60%"
                  height="12px"
                  style={{ marginTop: 'var(--spacing-2, 2px)' }}
                />
              </div>
            </div>
            <SkeletonBlock width="100%" height="120px" />
          </div>
        </section>

        {/* Empty & Error States */}
        <section style={{ marginBottom: 'var(--spacing-12, 24px)' }}>
          <h3 style={{ color: 'var(--color-text-0)', marginBottom: 'var(--spacing-6, 8px)' }}>
            Empty & Error States
          </h3>
          <Card variant="default">
            <EmptyState
              title="Пусто"
              description="Здесь пока ничего нет"
              action={<Button variant="primary">Добавить</Button>}
            />
          </Card>
          <Card variant="default" style={{ marginTop: 'var(--spacing-6, 8px)' }}>
            <ErrorState
              title="Ошибка"
              description="Что-то пошло не так"
              onRetry={() => toast.success('Повторная попытка')}
            />
          </Card>
        </section>

        {/* Toast & BottomSheet */}
        <section style={{ marginBottom: 'var(--spacing-12, 24px)' }}>
          <h3 style={{ color: 'var(--color-text-0)', marginBottom: 'var(--spacing-6, 8px)' }}>
            Toast & BottomSheet
          </h3>
          <div style={{ display: 'flex', gap: 'var(--spacing-4, 6px)', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => toast.success('Успешно!')}>
              Toast Success
            </Button>
            <Button variant="primary" onClick={() => toast.error('Ошибка!')}>
              Toast Error
            </Button>
            <Button variant="primary" onClick={() => toast.info('Информация')}>
              Toast Info
            </Button>
            <Button variant="secondary" onClick={() => setBottomSheetOpen(true)}>
              Open BottomSheet
            </Button>
          </div>
        </section>
      </div>

      <BottomSheet
        open={bottomSheetOpen}
        onClose={() => setBottomSheetOpen(false)}
        title="Bottom Sheet Demo"
      >
        <div style={{ color: 'var(--color-text-0)' }}>
          <p>Это пример BottomSheet компонента.</p>
          <p>Он слайдится снизу и поддерживает safe-area.</p>
          <Button variant="primary" onClick={() => setBottomSheetOpen(false)}>
            Закрыть
          </Button>
        </div>
      </BottomSheet>
    </AppShell>
  );
}
