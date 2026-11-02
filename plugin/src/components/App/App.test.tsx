import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

describe('App', () => {
  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <App meta={{} as any} basename="" onNavChanged={() => undefined} query={{} as any} path="" />
      </MemoryRouter>
    );
  });
});
