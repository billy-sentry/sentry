import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {TextArea} from '@sentry/scraps/textarea';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface Props extends ModalRenderProps {
  onSubmit: (query: string) => void;
  selectedHtml: string;
}

export default function ReplayInspectQueryModal({
  Header,
  Body,
  Footer,
  closeModal,
  onSubmit,
  selectedHtml,
}: Props) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSubmit(query.trim());
    }
  };

  // Show a truncated preview of the selected HTML
  const htmlPreview =
    selectedHtml.length > 200 ? selectedHtml.slice(0, 200) + '...' : selectedHtml;

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Ask Seer About This Element')}</h4>
      </Header>
      <form onSubmit={handleSubmit}>
        <Body>
          <FieldGroup>
            <Label>{t('Selected Element')}</Label>
            <StyledTextarea value={htmlPreview} readOnly rows={4} />
          </FieldGroup>
          <FieldGroup>
            <Label>{t('What would you like to know?')}</Label>
            <Input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t(
                'e.g. Why is this button not working? What errors relate to this component?'
              )}
              autoFocus
            />
          </FieldGroup>
        </Body>
        <Footer>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button type="submit" priority="primary" disabled={!query.trim()}>
            {t('Ask Seer')}
          </Button>
        </Footer>
      </form>
    </Fragment>
  );
}

const FieldGroup = styled('div')`
  margin-bottom: ${space(2)};

  &:last-child {
    margin-bottom: 0;
  }
`;

const Label = styled('label')`
  display: block;
  font-weight: ${p => p.theme.font.weight.sans.medium};
  margin-bottom: ${space(1)};
`;

const StyledTextarea = styled(TextArea)`
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  resize: none;
`;
