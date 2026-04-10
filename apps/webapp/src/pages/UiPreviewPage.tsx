import React, { useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  ListItem,
  Skeleton,
  EmptyState,
  ErrorState,
  useToast,
  Modal,
} from '../shared/ui/index.js';

export function UiPreviewPage() {
  const toast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <h1 style={{ color: 'var(--fg)', marginBottom: 'var(--sp-6)' }}>UI Kit Preview</h1>

      {/* Buttons */}
      <Card style={{ marginBottom: 'var(--sp-6)' }}>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
          <CardDescription>All button variants and states</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
            <Button variant="primary" isLoading>
              Loading
            </Button>
            <Button variant="primary" size="sm">
              Small
            </Button>
            <Button variant="primary" size="lg">
              Large
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Inputs */}
      <Card style={{ marginBottom: 'var(--sp-6)' }}>
        <CardHeader>
          <CardTitle>Inputs</CardTitle>
          <CardDescription>Input fields with different states</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <Input label="Normal input" placeholder="Enter text..." />
            <Input
              label="Input with hint"
              hint="This is a helpful hint"
              placeholder="Enter text..."
            />
            <Input
              label="Input with error"
              error="This field is required"
              placeholder="Enter text..."
            />
            <Input
              label="Controlled input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type here..."
            />
          </div>
        </CardContent>
      </Card>

      {/* List Items */}
      <Card style={{ marginBottom: 'var(--sp-6)' }}>
        <CardHeader>
          <CardTitle>List Items</CardTitle>
          <CardDescription>Clickable and non-clickable list items</CardDescription>
        </CardHeader>
        <CardContent>
          <ListItem
            title="Clickable item"
            subtitle="With subtitle"
            right="→"
            onClick={() => toast.show({ title: 'Clicked!', variant: 'info' })}
          />
          <ListItem title="Non-clickable item" subtitle="Just a div" />
          <ListItem
            title="Item with badge"
            subtitle="Has a badge on the right"
            right={<span style={{ color: 'var(--accent)' }}>New</span>}
            onClick={() => {}}
          />
        </CardContent>
      </Card>

      {/* Skeletons */}
      <Card style={{ marginBottom: 'var(--sp-6)' }}>
        <CardHeader>
          <CardTitle>Skeletons</CardTitle>
          <CardDescription>Loading placeholders</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <Skeleton width="100%" height="20px" />
            <Skeleton width="80%" height="20px" />
            <Skeleton width="60%" height="20px" radius="lg" />
            <Skeleton width="100%" height="100px" radius="md" />
          </div>
        </CardContent>
      </Card>

      {/* Empty State */}
      <Card style={{ marginBottom: 'var(--sp-6)' }}>
        <CardHeader>
          <CardTitle>Empty State</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No items found"
            description="Try adjusting your filters or create a new item"
            actionLabel="Create Item"
            onAction={() => toast.show({ title: 'Action clicked!', variant: 'success' })}
          />
        </CardContent>
      </Card>

      {/* Error State */}
      <Card style={{ marginBottom: 'var(--sp-6)' }}>
        <CardHeader>
          <CardTitle>Error State</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState
            title="Failed to load data"
            description="Please check your connection and try again"
            onAction={() => toast.show({ title: 'Retrying...', variant: 'info' })}
          />
        </CardContent>
      </Card>

      {/* Toast Demo */}
      <Card style={{ marginBottom: 'var(--sp-6)' }}>
        <CardHeader>
          <CardTitle>Toast</CardTitle>
          <CardDescription>Click buttons to show toasts</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
            <Button
              variant="primary"
              onClick={() =>
                toast.show({
                  title: 'Success!',
                  message: 'Operation completed',
                  variant: 'success',
                })
              }
            >
              Show Success
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                toast.show({ title: 'Error!', message: 'Something went wrong', variant: 'error' })
              }
            >
              Show Error
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast.show({ title: 'Info', message: 'Here is some information', variant: 'info' })
              }
            >
              Show Info
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal Demo */}
      <Card style={{ marginBottom: 'var(--sp-6)' }}>
        <CardHeader>
          <CardTitle>Modal</CardTitle>
          <CardDescription>Open modal dialog</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            Open Modal
          </Button>
          <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Example Modal">
            <p style={{ color: 'var(--fg)', marginBottom: 'var(--sp-4)' }}>
              This is a modal dialog. Click outside or press ESC to close.
            </p>
            <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setIsModalOpen(false)}>
                Confirm
              </Button>
            </div>
          </Modal>
        </CardContent>
      </Card>
    </div>
  );
}
