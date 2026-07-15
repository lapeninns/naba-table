import { fetchJson } from '@/lib/http/fetchJson';
import {
  buildEditableTemplateVariants,
  getRestaurantBookingEmailTemplateCatalog,
  getRestaurantBookingEmailTemplateDefinition,
  getRestaurantBookingEmailTemplateGroups,
} from '@/lib/restaurants/email-templates';

import { DevRestaurantSettings } from './devRestaurantSettings';

import type {
  RestaurantBookingEmailTemplateKey,
  RestaurantEmailTemplateVariant,
} from '@/lib/restaurants/email-templates';
import type {
  PreviewEmailTemplateInput,
  RestaurantEmailTemplate,
  RestaurantEmailTemplateGroup,
  RestaurantEmailTemplatePreview,
  RestaurantEmailTemplatesSnapshot,
  SendTestEmailTemplateInput,
} from '@/services/ops/restaurants';

const AVAILABLE_VARIABLES = [
  '{{name}}',
  '{{firstName}}',
  '{{venue}}',
  '{{date}}',
  '{{time}}',
  '{{party}}',
];

export class DevRestaurantEmailTemplates extends DevRestaurantSettings {
  async getEmailTemplates(restaurantId: string): Promise<RestaurantEmailTemplatesSnapshot> {
    const restaurant = this.getRestaurantSnapshot(restaurantId);

    return {
      restaurantId,
      canEdit: true,
      groups: getRestaurantBookingEmailTemplateGroups().map<RestaurantEmailTemplateGroup>(
        (group) => ({
          key: group.key,
          title: group.title,
          description: group.description,
          templates: getRestaurantBookingEmailTemplateCatalog()
            .filter((definition) => definition.group === group.key)
            .map<RestaurantEmailTemplate>((definition) => {
              const variants = buildEditableTemplateVariants(
                definition.key,
                restaurant.emailTemplates,
              );
              return {
                key: definition.key,
                title: definition.title,
                description: definition.description,
                groupKey: definition.group,
                supportsCtaLabel: definition.supportsCtaLabel,
                availableVariables: AVAILABLE_VARIABLES,
                recommendedVariables: definition.recommendedVariables.map((key) => `{{${key}}}`),
                authoringHints: [...definition.authoringHints],
                status: restaurant.emailTemplates?.templates[definition.key] ? 'custom' : 'default',
                activeVariantCount: variants.filter((variant) => variant.isActive).length,
                variants,
                defaultVariants: buildEditableTemplateVariants(definition.key, null),
              };
            }),
        }),
      ),
    };
  }

  async updateEmailTemplate(
    restaurantId: string,
    templateKey: RestaurantBookingEmailTemplateKey,
    payload: { variants: RestaurantEmailTemplateVariant[] },
  ) {
    const restaurant = this.getRestaurantSnapshot(restaurantId);
    const current = restaurant.emailTemplates ?? { version: 1 as const, templates: {} };
    restaurant.emailTemplates = {
      version: 1,
      templates: {
        ...current.templates,
        [templateKey]: { variants: payload.variants },
      },
    };

    const definition = getRestaurantBookingEmailTemplateDefinition(templateKey);
    return {
      key: definition.key,
      title: definition.title,
      description: definition.description,
      groupKey: definition.group,
      supportsCtaLabel: definition.supportsCtaLabel,
      availableVariables: AVAILABLE_VARIABLES,
      recommendedVariables: definition.recommendedVariables.map((key) => `{{${key}}}`),
      authoringHints: [...definition.authoringHints],
      status: 'custom' as const,
      activeVariantCount: payload.variants.filter((variant) => variant.isActive).length,
      variants: payload.variants,
      defaultVariants: buildEditableTemplateVariants(templateKey, null),
    };
  }

  async resetEmailTemplate(restaurantId: string, templateKey: RestaurantBookingEmailTemplateKey) {
    const restaurant = this.getRestaurantSnapshot(restaurantId);
    const current = restaurant.emailTemplates ?? { version: 1 as const, templates: {} };
    const templates = { ...current.templates };
    delete templates[templateKey];
    restaurant.emailTemplates = { version: 1, templates };

    const definition = getRestaurantBookingEmailTemplateDefinition(templateKey);
    const variants = buildEditableTemplateVariants(templateKey, null);
    return {
      key: definition.key,
      title: definition.title,
      description: definition.description,
      groupKey: definition.group,
      supportsCtaLabel: definition.supportsCtaLabel,
      availableVariables: AVAILABLE_VARIABLES,
      recommendedVariables: definition.recommendedVariables.map((key) => `{{${key}}}`),
      authoringHints: [...definition.authoringHints],
      status: 'default' as const,
      activeVariantCount: variants.filter((variant) => variant.isActive).length,
      variants,
      defaultVariants: variants,
    };
  }

  async previewEmailTemplate(
    restaurantId: string,
    templateKey: RestaurantBookingEmailTemplateKey,
    payload: PreviewEmailTemplateInput = {},
  ): Promise<RestaurantEmailTemplatePreview> {
    const restaurant = this.getRestaurantSnapshot(restaurantId);
    const response = await fetchJson<{
      restaurantId: string;
      preview: RestaurantEmailTemplatePreview;
    }>('/dev/api/restaurant-email-template-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateKey,
        preferredVariantId: payload.preferredVariantId,
        recipientEmail: 'preview@nabatable.local',
        variants: payload.variants?.length
          ? payload.variants
          : buildEditableTemplateVariants(templateKey, restaurant.emailTemplates),
        venue: {
          id: restaurant.profile.id,
          slug: restaurant.profile.slug,
          name: restaurant.profile.name,
          managerName: restaurant.profile.managerName,
          timezone: restaurant.profile.timezone,
          address: restaurant.profile.address,
          phone: restaurant.profile.contactPhone,
          email: restaurant.profile.contactEmail,
          policy: restaurant.profile.bookingPolicy,
          logoUrl: restaurant.profile.logoUrl,
          googleMapUrl: restaurant.profile.googleMapUrl,
          googleReviewUrl: restaurant.profile.googleReviewUrl,
        },
      }),
    });
    return response.preview;
  }

  async sendTestEmailTemplate(
    restaurantId: string,
    templateKey: RestaurantBookingEmailTemplateKey,
    payload: SendTestEmailTemplateInput,
  ) {
    return {
      ok: true as const,
      restaurantId,
      provider: 'mock' as const,
      messageId: `mock-${templateKey}`,
      preview: await this.previewEmailTemplate(restaurantId, templateKey, payload),
    };
  }
}
