# Email Notification Triggers

This document outlines the events and conditions that trigger transactional emails to be sent to customers. The system uses a BullMQ queue to process these jobs, ensuring resilience and non-blocking operation.

---

## Email Trigger Matrix

| Trigger Event                       | Recipient        | Purpose of Email                                                                                                                                       | Technical Details                                                                          |
| :---------------------------------- | :--------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------- |
| **--- Booking Flow ---**            |                  |                                                                                                                                                        |                                                                                            |
| **Booking Request Received**        | Customer         | To confirm that a booking request is pending and awaiting confirmation from the restaurant.                                                            | **Job Type**: `request_received`<br>**Function**: `sendBookingConfirmationEmail`           |
| **Booking Confirmed**               | Customer         | To confirm a booking and provide the final reservation ticket with all details. This is sent when a booking moves from a pending state to `confirmed`. | **Job Type**: `confirmation`<br>**Function**: `sendBookingConfirmationEmail`               |
| **Booking Updated by Admin**        | Customer         | To notify the customer that their booking details (e.g., time, party size) have been changed by the restaurant.                                        | **Function**: `sendBookingUpdateEmail`                                                     |
| **Booking Rescheduled (Pending)**   | Customer         | To confirm that a customer's request to reschedule is pending a new table assignment.                                                                  | **Function**: `sendBookingModificationPendingEmail`                                        |
| **Booking Rescheduled (Confirmed)** | Customer         | To confirm that a customer's rescheduling request has been approved and the booking is updated.                                                        | **Function**: `sendBookingModificationConfirmedEmail`                                      |
| **Booking Cancelled**               | Customer         | To confirm the cancellation of a reservation, either by the customer or the system.                                                                    | **Function**: `sendBookingCancellationEmail`                                               |
| **Booking Request Rejected**        | Customer         | To inform the customer that the restaurant could not accommodate their booking request.                                                                | **Job Type**: `booking_rejected`<br>**Function**: `sendBookingRejectedEmail`               |
| **Restaurant Cancels Booking**      | Customer         | To inform the customer that their previously confirmed booking was cancelled by the restaurant due to unforeseen circumstances.                        | **Job Type**: `restaurant_cancellation`<br>**Function**: `sendRestaurantCancellationEmail` |
| **--- Reminders ---**               |                  |                                                                                                                                                        |                                                                                            |
| **24-Hour Reminder**                | Customer         | To remind the customer of their upcoming appointment 24 hours in advance. Scheduled only for `confirmed` bookings.                                     | **Job Type**: `reminder_24h`<br>**Function**: `sendBookingReminderEmail`                   |
| **Short-Time Reminder**             | Customer         | To send a final, short-notice reminder (e.g., 2 hours) before the appointment. Scheduled only for `confirmed` bookings.                                | **Job Type**: `reminder_short`<br>**Function**: `sendBookingReminderEmail`                 |
| **--- Post-Booking ---**            |                  |                                                                                                                                                        |                                                                                            |
| **Feedback/Review Request**         | Customer         | To thank the customer for their visit and ask them to leave a review. Scheduled for an hour after the booking is `completed`.                          | **Job Type**: `review_request`<br>**Function**: `sendBookingReviewRequestEmail`            |
| **--- Team Management ---**         |                  |                                                                                                                                                        |                                                                                            |
| **Team Member Invitation**          | Prospective User | To invite a new user to join a restaurant's team on the platform.                                                                                      | **Function**: `sendTeamInviteEmail`                                                        |

---

## Email Suppression Conditions

To maintain high deliverability and comply with best practices, the system will **not** send an email under the following conditions:

1.  **Global Suppression Flag**:
    - An `is_email_suppressed` flag exists on the global `user_profiles` table.
    - If this flag is `true` for a user, **no emails** of any kind will be sent to them.
    - The email worker checks this flag before processing any email job.

2.  **Webhook Triggers for Suppression**:
    - The suppression flag is automatically set to `true` if the email provider (Resend) sends a webhook event indicating:
      - `email.bounced`: The email address is invalid or permanently rejected emails.
      - `email.complaint`: The user marked an email as spam.

3.  **Invalid Email Address**:
    - The logic that schedules reminder and review emails first validates that the customer's email address appears to be a valid format.

4.  **Stale Job Data**:
    - Before sending any email, the worker re-fetches the booking's current status from the database. If the status is no longer relevant (e.g., a reminder job runs for a booking that has since been `cancelled`), the email is skipped.
