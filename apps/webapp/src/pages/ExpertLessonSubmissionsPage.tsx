import React from 'react';
import { useParams } from 'react-router-dom';
import type { ContractsV1 } from '@tracked/shared';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton, useToast } from '../shared/ui/index.js';
import { useExpertLessonSubmissions, useDecideSubmission } from '../shared/queries/useExpertLessonSubmissions.js';
import { config } from '../shared/config/flags.js';
import { buildUrl } from '../shared/api/url.js';
import { downloadAuthenticatedFile } from '../shared/api/index.js';

function baseUrl(): string {
  return config.API_BASE_URL || (typeof window !== 'undefined' ? (window.location?.origin ?? '') : '');
}

/** Telegram @username for display (users.username in DB). */
function formatStudentTelegramLabel(username: string | null | undefined): string {
  const u = typeof username === 'string' ? username.trim() : '';
  if (!u) return 'ученика';
  const withoutAt = u.startsWith('@') ? u.slice(1) : u;
  return `@${withoutAt}`;
}

function scoreReadLabel(score: number | null): string {
  if (score == null) return 'Без оценки';
  return `${score} из 5`;
}

/** S3 key for student attachment (camelCase or legacy snake_case from JSON). */
function getSubmissionFileStorageKey(s: ContractsV1.SubmissionV1): string | null {
  const row = s as ContractsV1.SubmissionV1 & { file_key?: string | null };
  const raw = row.fileKey ?? row.file_key;
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length ? t : null;
}

function displayFilenameFromSubmissionKey(key: string): string {
  const i = key.lastIndexOf('/');
  const tail = i >= 0 ? key.slice(i + 1) : key;
  const withoutTs = tail.replace(/^\d+-/, '');
  return (withoutTs || tail || 'файл').trim() || 'файл';
}

export function ExpertLessonSubmissionsPage() {
  const toast = useToast();
  const { expertId, lessonId } = useParams<{ expertId: string; lessonId: string }>();
  const eId = expertId ?? '';
  const lId = lessonId ?? '';

  const { data, isLoading, error, refetch } = useExpertLessonSubmissions(eId, lId);
  const decide = useDecideSubmission(eId, lId);
  const [scoreById, setScoreById] = React.useState<Record<string, number | null>>({});
  const [commentById, setCommentById] = React.useState<Record<string, string>>({});
  /** When true, expert is editing a submission that is already `accepted`. */
  const [gradingEditById, setGradingEditById] = React.useState<Record<string, boolean>>({});

  const download = async (submissionId: string, fallbackFilename = 'submission') => {
    try {
      const url = buildUrl(baseUrl(), `/experts/${eId}/lessons/${lId}/submissions/${submissionId}/file`);
      await downloadAuthenticatedFile({ url, fallbackFilename });
    } catch {
      toast.show({ title: 'Ошибка', message: 'Не удалось скачать файл', variant: 'error' });
    }
  };

  if (!eId || !lId) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Сабмиты</CardTitle>
            <CardDescription>Некорректные параметры</CardDescription>
          </CardHeader>
          <CardContent>{/* back handled by Telegram BackButton */}</CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Skeleton width="60%" height="28px" style={{ marginBottom: 'var(--sp-3)' }} />
        <Skeleton width="100%" height="120px" radius="lg" style={{ marginBottom: 'var(--sp-3)' }} />
        <Skeleton width="100%" height="120px" radius="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Не удалось загрузить сабмиты</CardTitle>
            <CardDescription>Попробуйте ещё раз</CardDescription>
          </CardHeader>
          <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => refetch()}>
              Повторить
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const items = data.items ?? [];

  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>Сабмиты</CardTitle>
          <CardDescription>Урок: {lId}</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => refetch()}>
            Обновить
          </Button>
        </CardContent>
      </Card>

      {items.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Пока нет сабмитов</CardTitle>
            <CardDescription>Когда студенты отправят ответы, они появятся тут.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {items.map((s) => {
          const score = scoreById[s.id] ?? (typeof s.score === 'number' ? s.score : null);
          const comment = commentById[s.id] ?? (s.reviewerComment ?? '');
          const isAccepted = s.status === 'accepted';
          const isViewOnly = isAccepted && !gradingEditById[s.id];
          const attachmentKey = getSubmissionFileStorageKey(s);
          const attachmentName = attachmentKey ? displayFilenameFromSubmissionKey(attachmentKey) : null;

          return (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle style={{ fontSize: 'var(--text-md)', lineHeight: 1.35 }}>
                  Домашнее задание от {formatStudentTelegramLabel(s.studentTelegramUsername)}
                </CardTitle>
              </CardHeader>
              <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                {s.text && (
                  <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 'var(--text-sm)' }}>{s.text}</pre>
                )}
                {s.link && (
                  <a href={s.link} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                    {s.link}
                  </a>
                )}

                {attachmentKey && attachmentName ? (
                  <div
                    style={{
                      padding: 'var(--sp-3)',
                      borderRadius: 'var(--r-md)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--sp-2)',
                    }}
                  >
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Файл ответа ученика</div>
                    <div
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--muted-fg)',
                        wordBreak: 'break-word',
                      }}
                    >
                      {attachmentName}
                    </div>
                    <div>
                      <Button variant="secondary" size="sm" onClick={() => download(s.id, attachmentName)}>
                        Скачать файл
                      </Button>
                    </div>
                  </div>
                ) : null}

                {isViewOnly ? (
                  <>
                    <div style={{ color: 'var(--fg)', fontSize: 'var(--text-sm)' }}>
                      Оценка: {scoreReadLabel(score)}
                    </div>
                    {comment.trim() ? (
                      <div style={{ color: 'var(--muted-fg)', fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap' }}>
                        Комментарий: {comment}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--muted-fg)', fontSize: 'var(--text-xs)' }}>Комментарий не указан</div>
                    )}
                    <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setGradingEditById((m) => ({ ...m, [s.id]: true }))}
                      >
                        Редактировать
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ color: 'var(--muted-fg)', fontSize: 'var(--text-xs)' }}>Оценка:</div>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Button
                          key={n}
                          variant={score === n ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => setScoreById((m) => ({ ...m, [s.id]: n }))}
                        >
                          {n}
                        </Button>
                      ))}
                      <Button
                        variant={score == null ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setScoreById((m) => ({ ...m, [s.id]: null }))}
                      >
                        Без оценки
                      </Button>
                    </div>
                    <textarea
                      value={comment}
                      onChange={(e) => setCommentById((m) => ({ ...m, [s.id]: e.target.value }))}
                      placeholder="Комментарий (опционально)"
                      style={{
                        width: '100%',
                        minHeight: 90,
                        padding: 'var(--sp-3)',
                        borderRadius: 'var(--r-md)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'var(--card)',
                        color: 'var(--fg)',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={async () => {
                          try {
                            await decide.mutateAsync({
                              submissionId: s.id,
                              status: 'accepted',
                              score,
                              reviewerComment: comment,
                            });
                            setGradingEditById((m) => {
                              const next = { ...m };
                              delete next[s.id];
                              return next;
                            });
                            toast.show({ title: 'Сохранено', message: 'Оценка и комментарий сохранены', variant: 'success' });
                          } catch {
                            toast.show({ title: 'Ошибка', message: 'Не удалось сохранить', variant: 'error' });
                          }
                        }}
                        disabled={decide.isPending}
                      >
                        Сохранить
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
