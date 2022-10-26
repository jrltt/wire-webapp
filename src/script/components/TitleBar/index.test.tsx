/*
 * Wire
 * Copyright (C) 2022 Wire Swiss GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 *
 */

import {render, waitFor, fireEvent} from '@testing-library/react';
import ko from 'knockout';
import TitleBar from 'Components/TitleBar';
import {WebAppEvents} from '@wireapp/webapp-events';
import {UserState} from '../../user/UserState';
import {CallState} from '../../calling/CallState';
import {TeamState} from '../../team/TeamState';
import {TestFactory} from '../../../../test/helper/TestFactory';
import {CallingRepository} from '../../calling/CallingRepository';
import {Conversation} from '../../entity/Conversation';
import {createRandomUuid} from 'Util/util';
import {LegalHoldModalViewModel} from '../../view_model/content/LegalHoldModalViewModel';
import {Runtime} from '@wireapp/commons';
import {PanelViewModel} from '../../view_model/PanelViewModel';
import {ConversationVerificationState} from '../../conversation/ConversationVerificationState';
import {User} from '../../entity/User';
import {QualifiedId} from '@wireapp/api-client/lib/user';
import {amplify} from 'amplify';
import {ContentViewModel} from '../../view_model/ContentViewModel';

jest.spyOn(Runtime, 'isSupportingConferenceCalling').mockReturnValue(true);

const testFactory = new TestFactory();
let callingRepository: CallingRepository;

beforeAll(() => {
  return testFactory.exposeCallingActors().then(injectedCallingRepository => {
    callingRepository = injectedCallingRepository;
    return callingRepository;
  });
});

const callActions = {
  answer: jest.fn(),
  changePage: jest.fn(),
  leave: jest.fn(),
  reject: jest.fn(),
  startAudio: jest.fn(),
  startVideo: jest.fn(),
  switchCameraInput: jest.fn(),
  switchScreenInput: jest.fn(),
  toggleCamera: jest.fn(),
  toggleMute: jest.fn(),
  toggleScreenshare: jest.fn(),
};

const getDefaultProps = (callingRepository: CallingRepository) => ({
  callActions,
  callState: new CallState(),
  callingRepository,
  conversation: new Conversation(createRandomUuid()),
  legalHoldModal: {
    showRequestModal: () => Promise.resolve(),
    showUsers: () => Promise.resolve(),
  } as LegalHoldModalViewModel,
  panelViewModel: createPanelViewModel(),
  teamState: new TeamState(),
  userState: new UserState(),
});

describe('TitleBar', () => {
  it('subscribes to shortcut PEOPLE and add ADD_PEOPLE events on mount', async () => {
    spyOn(amplify, 'subscribe').and.returnValue(undefined);
    await render(<TitleBar {...getDefaultProps(callingRepository)} />);
    await waitFor(() => {
      expect(amplify.subscribe).toHaveBeenCalledWith(WebAppEvents.SHORTCUT.PEOPLE, expect.anything());
      expect(amplify.subscribe).toHaveBeenCalledWith(WebAppEvents.SHORTCUT.ADD_PEOPLE, expect.anything());
    });
  });

  it("doesn't show conversation search button for user with activated account", async () => {
    const userState = createUserState({isActivatedAccount: ko.pureComputed(() => false)});
    const {queryByText} = render(<TitleBar {...getDefaultProps(callingRepository)} userState={userState} />);

    expect(queryByText('tooltipConversationSearch')).toBeNull();
  });

  it('opens search area after search button click', async () => {
    const userState = createUserState({isActivatedAccount: ko.pureComputed(() => true)});
    const {getByText} = render(<TitleBar {...getDefaultProps(callingRepository)} userState={userState} />);

    const searchButton = getByText('tooltipConversationSearch');
    expect(searchButton).toBeDefined();

    spyOn(amplify, 'publish').and.returnValue(undefined);
    fireEvent.click(searchButton);
    expect(amplify.publish).toHaveBeenCalledWith(WebAppEvents.CONTENT.SWITCH, ContentViewModel.STATE.COLLECTION);
  });

  it('opens conversation details on conversation name click', async () => {
    const userState = createUserState({isActivatedAccount: ko.pureComputed(() => true)});
    const panelViewModel = createPanelViewModel();
    const displayName = 'test name';
    const conversation = createConversationEntity({
      display_name: ko.pureComputed(() => displayName),
    });

    const {getByText} = render(
      <TitleBar
        {...getDefaultProps(callingRepository)}
        userState={userState}
        conversation={conversation}
        panelViewModel={panelViewModel}
      />,
    );

    const conversationName = getByText(displayName);
    expect(conversationName).toBeDefined();

    fireEvent.click(conversationName);
    expect(panelViewModel.togglePanel).toHaveBeenCalledWith(PanelViewModel.STATE.CONVERSATION_DETAILS, {
      entity: conversation,
    });
  });

  it('opens conversation details on info button click', async () => {
    const userState = createUserState({isActivatedAccount: ko.pureComputed(() => true)});
    const panelViewModel = createPanelViewModel();
    const conversation = createConversationEntity();

    const {getByLabelText} = render(
      <TitleBar
        {...getDefaultProps(callingRepository)}
        userState={userState}
        conversation={conversation}
        panelViewModel={panelViewModel}
      />,
    );

    const infoButton = getByLabelText('tooltipConversationInfo');
    expect(infoButton).toBeDefined();
    fireEvent.click(infoButton);
    expect(panelViewModel.togglePanel).toHaveBeenCalledWith(PanelViewModel.STATE.CONVERSATION_DETAILS, {
      entity: conversation,
    });
  });

  it("doesn't show legal-hold icon for non legal-hold user", async () => {
    const userState = createUserState({isActivatedAccount: ko.pureComputed(() => true)});
    const conversation = createConversationEntity({hasLegalHold: ko.pureComputed(() => false)});

    const {container} = render(
      <TitleBar {...getDefaultProps(callingRepository)} userState={userState} conversation={conversation} />,
    );

    const legalHoldDotButton = container.querySelector('button[data-uie-name="status-legal-hold-conversation"]');
    expect(legalHoldDotButton).toBeNull();
  });

  it('shows legal-hold icon for legal-hold user', async () => {
    const userState = createUserState({isActivatedAccount: ko.pureComputed(() => true)});
    const conversation = createConversationEntity({hasLegalHold: ko.pureComputed(() => true)});

    const {container} = render(
      <TitleBar {...getDefaultProps(callingRepository)} userState={userState} conversation={conversation} />,
    );

    const legalHoldDotButton = container.querySelector('button[data-uie-name="status-legal-hold-conversation"]');
    expect(legalHoldDotButton).not.toBeNull();
  });

  it.each([ConversationVerificationState.UNVERIFIED, ConversationVerificationState.DEGRADED])(
    "doesn't show verified icon in not-verified conversation",
    async state => {
      const userState = createUserState({isActivatedAccount: ko.pureComputed(() => true)});
      const conversation = createConversationEntity({
        verification_state: ko.observable<ConversationVerificationState>(state),
      });

      const {container} = render(
        <TitleBar {...getDefaultProps(callingRepository)} userState={userState} conversation={conversation} />,
      );

      const verifiedIcon = container.querySelector('[data-uie-name="conversation-title-bar-verified-icon"]');
      expect(verifiedIcon).toBeNull();
    },
  );

  it('shows verified icon in verified conversation', async () => {
    const userState = createUserState({isActivatedAccount: ko.pureComputed(() => true)});
    const conversation = createConversationEntity({
      verification_state: ko.observable<ConversationVerificationState>(ConversationVerificationState.VERIFIED),
    });

    const {container} = render(
      <TitleBar {...getDefaultProps(callingRepository)} userState={userState} conversation={conversation} />,
    );

    const verifiedIcon = container.querySelector('[data-uie-name="conversation-title-bar-verified-icon"]');
    expect(verifiedIcon).not.toBeNull();
  });

  it('starts audio call on audio call button click', async () => {
    const firstUser = new User();
    const conversation = createConversationEntity({
      firstUserEntity: ko.pureComputed(() => firstUser),
      is1to1: ko.pureComputed(() => true),
      participating_user_ids: ko.observableArray([
        {domain: '', id: ''},
        {domain: '', id: ''},
      ] as QualifiedId[]),
    });
    const {getByLabelText} = render(<TitleBar {...getDefaultProps(callingRepository)} conversation={conversation} />);

    const audioCallButton = getByLabelText('tooltipConversationCall');
    expect(audioCallButton).toBeDefined();
    fireEvent.click(audioCallButton);
    expect(callActions.startAudio).toHaveBeenCalledWith(conversation);
  });

  it("doesn't show video call button when video calling is not enabled", async () => {
    const firstUser = new User();
    const conversation = createConversationEntity({
      firstUserEntity: ko.pureComputed(() => firstUser),
      is1to1: ko.pureComputed(() => true),
      participating_user_ids: ko.observableArray([
        {domain: '', id: ''},
        {domain: '', id: ''},
      ] as QualifiedId[]),
    });

    const teamState = createTeamState({isVideoCallingEnabled: ko.pureComputed(() => false)});

    const {queryByLabelText} = render(
      <TitleBar {...getDefaultProps(callingRepository)} conversation={conversation} teamState={teamState} />,
    );

    const videoCallButton = queryByLabelText('tooltipConversationVideoCall');
    expect(videoCallButton).toBeNull();
  });

  it('starts video call on video call button click', async () => {
    const firstUser = new User();
    const teamState = createTeamState({isVideoCallingEnabled: ko.pureComputed(() => true)});
    const conversation = createConversationEntity({
      firstUserEntity: ko.pureComputed(() => firstUser),
      is1to1: ko.pureComputed(() => true),
      participating_user_ids: ko.observableArray([
        {domain: '', id: ''},
        {domain: '', id: ''},
      ] as QualifiedId[]),
    });

    const {getByLabelText} = render(
      <TitleBar {...getDefaultProps(callingRepository)} conversation={conversation} teamState={teamState} />,
    );

    const videoCallButton = getByLabelText('tooltipConversationVideoCall');
    expect(videoCallButton).toBeDefined();

    fireEvent.click(videoCallButton);
    expect(callActions.startVideo).toHaveBeenCalledWith(conversation);
  });

  it('displays warning badge', async () => {
    const conversation = createConversationEntity({
      hasDirectGuest: ko.pureComputed(() => true),
      isGroup: ko.pureComputed(() => true),
    });

    const {getByText} = render(<TitleBar {...getDefaultProps(callingRepository)} conversation={conversation} />);

    expect(getByText('guestRoomConversationBadge')).toBeDefined();
  });
});

function createPanelViewModel() {
  const panelViewModel: Partial<PanelViewModel> = {
    isVisible: ko.pureComputed<boolean>(() => true),
    togglePanel: jest.fn(),
  };
  return panelViewModel as PanelViewModel;
}

function createUserState(user?: Partial<UserState>) {
  const userState = new UserState();
  return Object.assign(userState, user) as UserState;
}

function createTeamState(team?: Partial<TeamState>) {
  const teamState = new TeamState();
  return Object.assign(teamState, team) as TeamState;
}

function createConversationEntity(conversation?: Partial<Conversation>) {
  const conversationEntity = new Conversation();
  return Object.assign(conversationEntity, conversation) as Conversation;
}
