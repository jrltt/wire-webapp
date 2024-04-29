/*
 * Wire
 * Copyright (C) 2024 Wire Swiss GmbH
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

import {ChevronIcon, GroupIcon, InfoIcon, StarIcon} from '@wireapp/react-ui-kit';

import {Icon} from 'Components/Icon';
import {ConversationRepository} from 'src/script/conversation/ConversationRepository';
import {ConversationFolderTab} from 'src/script/page/LeftSidebar/panels/Conversations/ConversationTab/ConversationFolderTab';
import {SidebarTabs} from 'src/script/page/LeftSidebar/panels/Conversations/state';
import {t} from 'Util/LocalizerUtil';

import {Config} from '../../../../../Config';
import {Conversation} from '../../../../../entity/Conversation';
import {Shortcut} from '../../../../../ui/Shortcut';
import {ShortcutType} from '../../../../../ui/ShortcutType';
import {ConversationTab} from '../ConversationTab';

interface ConversationTabsProps {
  unreadConversations: Conversation[];
  favoriteConversations: Conversation[];
  archivedConversations: Conversation[];
  groupConversations: Conversation[];
  directConversations: Conversation[];
  conversationRepository: ConversationRepository;
  onChangeTab: (tab: SidebarTabs, folderId?: string) => void;
  currentTab: SidebarTabs;
  onClickPreferences: () => void;
}

export const ConversationTabs = ({
  unreadConversations,
  favoriteConversations,
  archivedConversations,
  groupConversations,
  conversationRepository,
  directConversations,
  onChangeTab,
  currentTab,
  onClickPreferences,
}: ConversationTabsProps) => {
  const totalUnreadConversations = unreadConversations.length;

  const totalUnreadFavoriteConversations = favoriteConversations.filter(favoriteConversation =>
    favoriteConversation.hasUnread(),
  ).length;

  const totalUnreadArchivedConversations = archivedConversations.filter(conversation =>
    conversation.hasUnread(),
  ).length;

  const conversationTabs = [
    {
      type: SidebarTabs.RECENT,
      title: t('conversationViewTooltip'),
      dataUieName: 'go-recent-view',
      Icon: <Icon.ConversationsOutline />,
      unreadConversations: unreadConversations.length,
    },
    {
      type: SidebarTabs.FAVORITES,
      title: t('conversationLabelFavorites'),
      dataUieName: 'go-favorites-view',
      Icon: <StarIcon />,
      unreadConversations: totalUnreadFavoriteConversations,
    },
    {
      type: SidebarTabs.GROUPS,
      title: t('conversationLabelGroups'),
      dataUieName: 'go-groups-view',
      Icon: <GroupIcon />,
      unreadConversations: groupConversations.filter(conversation => conversation.hasUnread()).length,
    },
    {
      type: SidebarTabs.DIRECTS,
      title: t('conversationLabelDirects'),
      dataUieName: 'go-directs-view',
      Icon: <Icon.People />,
      unreadConversations: directConversations.filter(conversation => conversation.hasUnread()).length,
    },
    {
      type: SidebarTabs.FOLDER,
      title: t('folderViewTooltip'),
      dataUieName: 'go-folders-view',
      Icon: <ChevronIcon />,
      unreadConversations: totalUnreadConversations,
    },
    {
      type: SidebarTabs.ARCHIVES,
      title: t('tooltipConversationsArchived', archivedConversations.length),
      label: t('conversationFooterArchive'),
      dataUieName: 'go-archive',
      Icon: <Icon.Archive />,
      unreadConversations: totalUnreadArchivedConversations,
    },
  ];

  return (
    <>
      <div
        role="tablist"
        aria-label={t('accessibility.headings.sidebar')}
        aria-owns="tab-1 tab-2 tab-3 tab-4 tab-5 tab-6 tab-7"
        className="conversations-sidebar-list"
      >
        <div className="conversations-sidebar-title">{t('videoCallOverlayConversations')}</div>

        {conversationTabs.map((conversationTab, index) => {
          if (conversationTab.type === SidebarTabs.FOLDER) {
            return (
              <ConversationFolderTab
                {...conversationTab}
                unreadConversations={unreadConversations}
                conversationRepository={conversationRepository}
                key={conversationTab.type}
                conversationTabIndex={index + 1}
                onChangeTab={onChangeTab}
                isActive={conversationTab.type === currentTab}
              />
            );
          }

          return (
            <ConversationTab
              {...conversationTab}
              key={conversationTab.type}
              conversationTabIndex={index + 1}
              onChangeTab={onChangeTab}
              isActive={conversationTab.type === currentTab}
            />
          );
        })}

        <div className="conversations-sidebar-title">{t('conversationFooterContacts')}</div>

        <ConversationTab
          title={t('searchConnect', Shortcut.getShortcutTooltip(ShortcutType.START))}
          label={t('searchConnect')}
          type={SidebarTabs.CONNECT}
          Icon={<Icon.Plus />}
          onChangeTab={onChangeTab}
          conversationTabIndex={conversationTabs.length + 1}
          dataUieName="go-people"
          isActive={currentTab === SidebarTabs.CONNECT}
        />
      </div>

      <div
        role="tablist"
        aria-label={t('accessibility.headings.sidebar.footer')}
        aria-owns="tab-1 tab-2"
        className="conversations-sidebar-list-footer"
      >
        <ConversationTab
          title={t('preferencesHeadline', Shortcut.getShortcutTooltip(ShortcutType.START))}
          label={t('preferencesHeadline')}
          type={SidebarTabs.PREFERENCES}
          Icon={<Icon.Settings />}
          onChangeTab={tab => {
            onChangeTab(tab);
            onClickPreferences();
          }}
          conversationTabIndex={1}
          dataUieName="go-preferences"
          isActive={currentTab === SidebarTabs.PREFERENCES}
        />

        <a
          rel="nofollow noopener noreferrer"
          target="_blank"
          href={Config.getConfig().URL.SUPPORT.INDEX}
          id="tab-2"
          type="button"
          className="conversations-sidebar-btn"
          title={t('preferencesAboutSupport', Shortcut.getShortcutTooltip(ShortcutType.START))}
          data-uie-name="go-people"
        >
          <span className="conversations-sidebar-btn--text-wrapper">
            <InfoIcon />
            <span className="conversations-sidebar-btn--text">{t('preferencesAboutSupport')}</span>
          </span>
        </a>
      </div>
    </>
  );
};
