/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { act, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { createMemoryHistory } from 'history';
import { License } from '@kbn/licensing-plugin/common/license';
import {
  LOGS_LOCATOR_ID,
  NODE_LOGS_LOCATOR_ID,
  TRACE_LOGS_LOCATOR_ID,
} from '@kbn/logs-shared-plugin/common';
import { Transaction } from '../../../../typings/es_schemas/ui/transaction';
import { ApmPluginContextValue } from '../../../context/apm_plugin/apm_plugin_context';
import {
  mockApmPluginContextValue,
  MockApmPluginContextWrapper,
  logsLocatorsMock,
} from '../../../context/apm_plugin/mock_apm_plugin_context';
import { LicenseContext } from '../../../context/license/license_context';
import * as hooks from '../../../hooks/use_fetcher';
import { expectTextsInDocument, expectTextsNotInDocument } from '../../../utils/test_helpers';
import { TransactionActionMenu } from './transaction_action_menu';
import * as Transactions from './__fixtures__/mock_data';
import { KibanaContextProvider } from '@kbn/kibana-react-plugin/public';
import * as useAdHocApmDataView from '../../../hooks/use_adhoc_apm_data_view';
import { useProfilingIntegrationSetting } from '../../../hooks/use_profiling_integration_setting';

const apmContextMock = {
  ...mockApmPluginContextValue,
  core: {
    ...mockApmPluginContextValue.core,
    application: { capabilities: { apm: { save: true }, ml: {} } },
  },
  share: {
    url: {
      locators: {
        get: (id: string) => {
          if (id === LOGS_LOCATOR_ID) {
            return logsLocatorsMock.logsLocator;
          }

          if (id === NODE_LOGS_LOCATOR_ID) {
            return logsLocatorsMock.nodeLogsLocator;
          }

          if (id === TRACE_LOGS_LOCATOR_ID) {
            return logsLocatorsMock.traceLogsLocator;
          }
        },
      },
    },
  },
} as unknown as ApmPluginContextValue;

jest.mock('../../../hooks/use_profiling_integration_setting', () => ({
  useProfilingIntegrationSetting: jest.fn().mockReturnValue(false),
}));

const history = createMemoryHistory();
history.replace(
  '/services/testbeans-go/transactions/view?rangeFrom=now-24h&rangeTo=now&transactionName=GET+%2Ftestbeans-go%2Fapi'
);

function Wrapper({ children }: { children?: React.ReactNode }) {
  const mockServices = {
    dataViews: {
      get: async () => {},
      create: jest.fn(),
    },
    spaces: {
      getActiveSpace: jest.fn().mockImplementation(() => ({ id: 'mockSpaceId' })),
    },
  };

  return (
    <MemoryRouter>
      <MockApmPluginContextWrapper value={apmContextMock} history={history}>
        <KibanaContextProvider services={mockServices}>{children}</KibanaContextProvider>
      </MockApmPluginContextWrapper>
    </MemoryRouter>
  );
}

const renderTransaction = async (transaction: Record<string, any>) => {
  const rendered = render(
    <TransactionActionMenu isLoading={false} transaction={transaction as Transaction} />,
    {
      wrapper: Wrapper,
    }
  );

  await act(async () => {
    fireEvent.click(rendered.getByText('Investigate'));
  });

  return rendered;
};

const expectLogsLocatorsToBeCalled = () => {
  expect(logsLocatorsMock.nodeLogsLocator.getRedirectUrl).toBeCalled();
  expect(logsLocatorsMock.traceLogsLocator.getRedirectUrl).toBeCalled();
};

let useAdHocApmDataViewSpy: jest.SpyInstance;

describe('TransactionActionMenu ', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  jest.spyOn(hooks, 'useFetcher').mockReturnValue({
    // return as Profiling had been initialized
    data: {
      initialized: true,
    },
    status: hooks.FETCH_STATUS.SUCCESS,
    refetch: jest.fn(),
  });

  useAdHocApmDataViewSpy = jest.spyOn(useAdHocApmDataView, 'useAdHocApmDataView');

  useAdHocApmDataViewSpy.mockImplementation(() => {
    return {
      dataView: {
        id: 'foo-1',
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the discover link when there is adhoc data view', async () => {
    const { findByText } = await renderTransaction(Transactions.transactionWithMinimalData);

    expect(findByText('View transaction in Discover')).not.toBeNull();
  });

  it('should call logs locators getRedirectUrl function', async () => {
    await renderTransaction(Transactions.transactionWithMinimalData);

    expectLogsLocatorsToBeCalled();
  });

  describe('when there is no pod id', () => {
    it('does not render the Pod logs link', async () => {
      const { queryByText } = await renderTransaction(Transactions.transactionWithMinimalData);

      expect(queryByText('Pod logs')).toBeNull();
    });

    it('does not render the Pod metrics link', async () => {
      const { queryByText } = await renderTransaction(Transactions.transactionWithMinimalData);

      expect(queryByText('Pod metrics')).toBeNull();
    });
  });

  describe('when there is a pod id', () => {
    it('should call logs locators getRedirectUrl function', async () => {
      await renderTransaction(Transactions.transactionWithKubernetesData);

      expectLogsLocatorsToBeCalled();
    });

    it('renders the pod metrics link', async () => {
      const { getByText } = await renderTransaction(Transactions.transactionWithKubernetesData);

      expect((getByText('Pod metrics').parentElement as HTMLAnchorElement).href).toEqual(
        'http://localhost/basepath/app/metrics/link-to/pod-detail/pod123456abcdef?from=1545091770952&to=1545092370952'
      );
    });
  });

  describe('when there is no container id', () => {
    it('does not render the Container logs link', async () => {
      const { queryByText } = await renderTransaction(Transactions.transactionWithMinimalData);

      expect(queryByText('Container logs')).toBeNull();
    });

    it('does not render the Container metrics link', async () => {
      const { queryByText } = await renderTransaction(Transactions.transactionWithMinimalData);

      expect(queryByText('Container metrics')).toBeNull();
    });
  });

  describe('should call logs locators getRedirectUrl function', () => {
    it('renders the Container logs link', async () => {
      await renderTransaction(Transactions.transactionWithContainerData);

      expectLogsLocatorsToBeCalled();
    });

    it('renders the Container metrics link', async () => {
      const { getByText } = await renderTransaction(Transactions.transactionWithContainerData);

      expect((getByText('Container metrics').parentElement as HTMLAnchorElement).href).toEqual(
        'http://localhost/basepath/app/metrics/link-to/container-detail/container123456abcdef?from=1545091770952&to=1545092370952'
      );
    });
  });

  describe('when there is no hostname', () => {
    it('does not render the Host logs link', async () => {
      const { queryByText } = await renderTransaction(Transactions.transactionWithMinimalData);

      expect(queryByText('Host logs')).toBeNull();
    });

    it('does not render the Host metrics link', async () => {
      const { queryByText } = await renderTransaction(Transactions.transactionWithMinimalData);

      expect(queryByText('Host metrics')).toBeNull();
    });
  });

  describe('when there is a hostname', () => {
    it('should call logs locators getRedirectUrl function', async () => {
      await renderTransaction(Transactions.transactionWithHostData);

      expectLogsLocatorsToBeCalled();
    });

    it('renders the Host metrics link', async () => {
      const { getByText } = await renderTransaction(Transactions.transactionWithHostData);

      expect((getByText('Host metrics').parentElement as HTMLAnchorElement).href).toEqual(
        'http://localhost/basepath/app/metrics/link-to/host-detail/227453131a17?from=1545091770952&to=1545092370952'
      );
    });
  });

  it('should not render the uptime link if there is no url available', async () => {
    const { queryByText } = await renderTransaction(Transactions.transactionWithMinimalData);

    expect(queryByText('Status')).toBeNull();
  });

  it('should not render the uptime link if there is no domain available', async () => {
    const { queryByText } = await renderTransaction(Transactions.transactionWithUrlWithoutDomain);

    expect(queryByText('Status')).toBeNull();
  });

  describe('when there is a url with a domain', () => {
    it('renders the uptime link', async () => {
      const { getByText } = await renderTransaction(Transactions.transactionWithUrlAndDomain);

      expect((getByText('Status').parentElement as HTMLAnchorElement).href).toEqual(
        'http://localhost/basepath/app/uptime?dateRangeStart=now-24h&dateRangeEnd=now&search=url.domain:%22example.com%22'
      );
    });
  });

  it('matches the snapshot', async () => {
    const { container } = await renderTransaction(Transactions.transactionWithAllData);

    expect(container).toMatchSnapshot();
  });

  describe('Profiling items', () => {
    beforeEach(() => {
      (useProfilingIntegrationSetting as jest.Mock).mockReturnValue(true);
    });

    it('renders flamegraph item', async () => {
      const component = await renderTransaction(Transactions.transactionWithHostData);
      expectTextsInDocument(component, ['Host flamegraph']);
    });
    it('renders topN functions item', async () => {
      const component = await renderTransaction(Transactions.transactionWithHostData);
      expectTextsInDocument(component, ['Host topN functions']);
    });
    it('renders stacktraces item', async () => {
      const component = await renderTransaction(Transactions.transactionWithHostData);
      expectTextsInDocument(component, ['Host stacktraces']);
    });
  });

  describe('Custom links', () => {
    afterAll(() => {
      jest.resetAllMocks();
    });
    function renderTransactionActionMenuWithLicense(license: License) {
      return render(
        <LicenseContext.Provider value={license}>
          <TransactionActionMenu
            isLoading={false}
            transaction={Transactions.transactionWithMinimalData as Transaction}
          />
        </LicenseContext.Provider>,
        { wrapper: Wrapper }
      );
    }
    it('doesnt show custom links when license is not valid', async () => {
      const license = new License({
        signature: 'test signature',
        license: {
          expiryDateInMillis: 0,
          mode: 'gold',
          status: 'invalid',
          type: 'gold',
          uid: '1',
        },
      });
      const component = renderTransactionActionMenuWithLicense(license);
      await act(async () => {
        fireEvent.click(component.getByText('Investigate'));
      });
      expectTextsNotInDocument(component, ['Custom Links']);
    });
    it('doesnt show custom links when basic license', async () => {
      const license = new License({
        signature: 'test signature',
        license: {
          expiryDateInMillis: 0,
          mode: 'basic',
          status: 'active',
          type: 'basic',
          uid: '1',
        },
      });
      const component = render(
        <LicenseContext.Provider value={license}>
          <TransactionActionMenu
            isLoading={false}
            transaction={Transactions.transactionWithMinimalData as Transaction}
          />
        </LicenseContext.Provider>,
        { wrapper: Wrapper }
      );
      await act(async () => {
        fireEvent.click(component.getByText('Investigate'));
      });
      expectTextsNotInDocument(component, ['Custom Links']);
    });
    it('shows custom links when trial license', async () => {
      const license = new License({
        signature: 'test signature',
        license: {
          expiryDateInMillis: 0,
          mode: 'trial',
          status: 'active',
          type: 'trial',
          uid: '1',
        },
      });
      const component = renderTransactionActionMenuWithLicense(license);
      await act(async () => {
        fireEvent.click(component.getByText('Investigate'));
      });
      expectTextsInDocument(component, ['Custom Links']);
    });
    it('shows custom links when gold license', async () => {
      const license = new License({
        signature: 'test signature',
        license: {
          expiryDateInMillis: 0,
          mode: 'gold',
          status: 'active',
          type: 'gold',
          uid: '1',
        },
      });
      const component = renderTransactionActionMenuWithLicense(license);
      await act(async () => {
        fireEvent.click(component.getByText('Investigate'));
      });
      expectTextsInDocument(component, ['Custom Links']);
    });
    it('opens flyout with filters prefilled', async () => {
      const license = new License({
        signature: 'test signature',
        license: {
          expiryDateInMillis: 0,
          mode: 'gold',
          status: 'active',
          type: 'gold',
          uid: '1',
        },
      });
      const component = renderTransactionActionMenuWithLicense(license);
      await act(async () => {
        fireEvent.click(component.getByText('Investigate'));
      });
      expectTextsInDocument(component, ['Custom Links']);
      await act(async () => {
        fireEvent.click(component.getByText('Create custom link'));
      });
      expectTextsInDocument(component, ['Create link']);
      const getFilterKeyValue = (key: string) => {
        return {
          [(component.getAllByText(key)[0] as HTMLOptionElement).text]: (
            component
              .getByTestId(`${key}.value`)
              .querySelector('[data-test-subj="comboBoxSearchInput"]') as HTMLInputElement
          ).value,
        };
      };
      expect(getFilterKeyValue('service.name')).toEqual({
        'service.name': 'opbeans-go',
      });
      expect(getFilterKeyValue('transaction.name')).toEqual({
        'transaction.name': 'GET /api/products/:id/customers',
      });
      expect(getFilterKeyValue('transaction.type')).toEqual({
        'transaction.type': 'request',
      });
      // Forces component to unmount to prevent to update the state when callApmAPI call returns after the test is finished.
      component.unmount();
    });
  });
});

describe('Profiling not initialized', () => {
  beforeAll(() => {
    jest.spyOn(hooks, 'useFetcher').mockReturnValue({
      // return as Profiling had not been initialized
      data: { initialized: false },
      status: hooks.FETCH_STATUS.SUCCESS,
      refetch: jest.fn(),
    });

    useAdHocApmDataViewSpy = jest.spyOn(useAdHocApmDataView, 'useAdHocApmDataView');

    useAdHocApmDataViewSpy.mockImplementation(() => {
      return {
        dataView: {
          id: 'foo-1',
        },
      };
    });
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  it('does not render flamegraph item', async () => {
    const component = await renderTransaction(Transactions.transactionWithHostData);
    expectTextsNotInDocument(component, ['Host flamegraph']);
  });
  it('does not render topN functions item', async () => {
    const component = await renderTransaction(Transactions.transactionWithHostData);
    expectTextsNotInDocument(component, ['Host topN functions']);
  });
  it('does not render stacktraces item', async () => {
    const component = await renderTransaction(Transactions.transactionWithHostData);
    expectTextsNotInDocument(component, ['Host stacktraces']);
  });
});
