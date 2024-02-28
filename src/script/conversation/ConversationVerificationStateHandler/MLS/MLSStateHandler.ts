/*
 * Wire
 * Copyright (C) 2023 Wire Swiss GmbH
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

import {CONVERSATION_TYPE} from '@wireapp/api-client/lib/conversation';
import {QualifiedId} from '@wireapp/api-client/lib/user';
import {E2eiConversationState} from '@wireapp/core/lib/messagingProtocols/mls';
import {container} from 'tsyringe';

import {
  getActiveWireIdentity,
  getAllGroupUsersIdentities,
  getConversationVerificationState,
  MLSStatuses,
} from 'src/script/E2EIdentity';
import {Conversation} from 'src/script/entity/Conversation';
import {E2EIVerificationMessageType} from 'src/script/message/E2EIVerificationMessageType';
import {Core} from 'src/script/service/CoreSingleton';
import {Logger, getLogger} from 'Util/Logger';
import {waitFor} from 'Util/waitFor';

import {isMLSConversation, MLSConversation} from '../../ConversationSelectors';
import {ConversationState} from '../../ConversationState';
import {ConversationVerificationState} from '../../ConversationVerificationState';
import {getConversationByGroupId, OnConversationE2EIVerificationStateChange} from '../shared';

class MLSConversationVerificationStateHandler {
  private readonly logger: Logger;

  public constructor(
    private readonly selfDomain: string,
    private readonly onConversationVerificationStateChange: OnConversationE2EIVerificationStateChange,
    private readonly onSelfClientCertificateRevoked: () => Promise<void>,
    private readonly conversationState: ConversationState,
    private readonly core: Core,
  ) {
    this.logger = getLogger('MLSConversationVerificationStateHandler');
    // We need to check if the core service is available and if the e2eIdentity is available
    if (!this.core.service?.mls || !this.core.service?.e2eIdentity) {
      return;
    }

    // We hook into the newEpoch event of the MLS service to check if the conversation needs to be verified or degraded
    this.core.service.mls.on('newEpoch', this.onEpochChanged);
    this.core.service.e2eIdentity.on('crlChanged', ({domain}) => this.handleNewRevocationList(domain));
  }

  /**
   * Changes mls verification state to "degraded"
   * @param conversation
   */
  private async degradeConversation(conversation: MLSConversation) {
    const userIdentities = await getAllGroupUsersIdentities(conversation.groupId);
    if (!userIdentities) {
      return;
    }

    const state = ConversationVerificationState.DEGRADED;
    conversation.mlsVerificationState(state);

    const degradedUsers: QualifiedId[] = [];
    for (const [userId, identities] of userIdentities.entries()) {
      if (identities.some(identity => identity.status !== MLSStatuses.VALID)) {
        degradedUsers.push({id: userId, domain: ''});
      }
    }

    this.onConversationVerificationStateChange({
      conversationEntity: conversation,
      conversationVerificationState: state,
      verificationMessageType: E2EIVerificationMessageType.NO_LONGER_VERIFIED,
      userIds: degradedUsers,
    });
  }

  /**
   * Changes mls verification state to "verified"
   * @param conversation
   */
  private async verifyConversation(conversation: MLSConversation) {
    const state = ConversationVerificationState.VERIFIED;
    conversation.mlsVerificationState(state);
    this.onConversationVerificationStateChange({
      conversationEntity: conversation,
      conversationVerificationState: state,
    });
  }

  /**
   * This function checks if self client certificate is revoked
   */
  private handleNewRevocationList = async (domain: string): Promise<void> => {
    if (domain === this.selfDomain) {
      // The crl of the self user has changed, we need to check if the self client certificate is revoked
      const activeIdentity = await getActiveWireIdentity();
      if (activeIdentity?.status === MLSStatuses.REVOKED) {
        await this.onSelfClientCertificateRevoked();
      }
    }
    await this.checkAllConversationsVerificationState();
  };

  /**
   * This function checks all conversations if they are verified or degraded and updates them accordingly
   */
  private checkAllConversationsVerificationState = async (): Promise<void> => {
    const conversations = this.conversationState.conversations();
    await Promise.all(conversations.map(conversation => this.checkConversationVerificationState(conversation)));
  };

  private onEpochChanged = async ({groupId}: {groupId: string}): Promise<void> => {
    // There could be a race condition where we would receive an epoch update for a conversation that is not yet known by the webapp.
    // We just wait for it to be available and then check the verification state
    const conversation = await waitFor(() =>
      getConversationByGroupId({conversationState: this.conversationState, groupId}),
    );

    if (!conversation) {
      return this.logger.warn(`Epoch changed but conversation could not be found after waiting for 5 seconds`);
    }

    return this.checkConversationVerificationState(conversation);
  };

  private checkConversationVerificationState = async (conversation: Conversation): Promise<void> => {
    const isSelfConversation = conversation.type() === CONVERSATION_TYPE.SELF;
    if (!isMLSConversation(conversation) || isSelfConversation) {
      return;
    }

    const conversationExists = await this.core.service?.mls?.conversationExists(conversation.groupId);
    if (!conversationExists) {
      conversation.mlsVerificationState(ConversationVerificationState.UNVERIFIED);
      return;
    }

    const verificationState = await getConversationVerificationState(conversation.groupId);

    if (
      verificationState === E2eiConversationState.NotVerified &&
      conversation.mlsVerificationState() === ConversationVerificationState.VERIFIED
    ) {
      return this.degradeConversation(conversation);
    } else if (
      verificationState === E2eiConversationState.Verified &&
      conversation.mlsVerificationState() !== ConversationVerificationState.VERIFIED
    ) {
      return this.verifyConversation(conversation);
    }
  };
}

export const registerMLSConversationVerificationStateHandler = (
  domain: string,
  onConversationVerificationStateChange: OnConversationE2EIVerificationStateChange = () => {},
  onSelfClientCertificateRevoked: () => Promise<void> = async () => {},
  conversationState: ConversationState = container.resolve(ConversationState),
  core: Core = container.resolve(Core),
): void => {
  new MLSConversationVerificationStateHandler(
    domain,
    onConversationVerificationStateChange,
    onSelfClientCertificateRevoked,
    conversationState,
    core,
  );
};
