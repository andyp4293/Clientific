import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendAppointmentConfirmation, formatPhoneNumber } from '@/lib/twilio';
import { sendNewBookingEmail } from '@/lib/email';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';

// POST - Create public booking (no auth required)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const business = await prisma.business.findUnique({
      where: { slug },
      select: { id: true, enableOnlineBooking: true, email: true, name: true, timezone: true, notifyNewBookingEmail: true },
    });

    if (!business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    if (!business.enableOnlineBooking) {
      return NextResponse.json(
        { error: 'Online booking is not enabled' },
        { status: 403 }
      );
    }

    const {
      serviceIds: rawServiceIds,
      serviceId: rawServiceId,
      staffId,
      startTime,
      duration,
      customerName,
      customerPhone,
      customerEmail,
      notes,
      smsConsent,
      smsMarketingConsent,
    } = await req.json();

    const transactionalConsent = Boolean(smsConsent);
    const marketingConsent = Boolean(smsMarketingConsent);

    // Support both serviceIds[] (new) and serviceId (legacy)
    const serviceIds: string[] = rawServiceIds?.length
      ? rawServiceIds
      : rawServiceId
        ? [rawServiceId]
        : [];

    // Validation
    if (!serviceIds.length || !startTime || !duration || !customerName || !customerPhone) {
      return NextResponse.json(
        { error: 'Service, start time, duration, name, and phone are required' },
        { status: 400 }
      );
    }

    // Input length guards — prevent oversized payloads from bots
    if (typeof customerName !== 'string' || customerName.trim().length === 0 || customerName.length > 100) {
      return NextResponse.json({ error: 'Name must be 1–100 characters' }, { status: 400 });
    }
    if (customerPhone && (typeof customerPhone !== 'string' || customerPhone.length > 30)) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }
    if (customerEmail && (typeof customerEmail !== 'string' || customerEmail.length > 254)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    if (notes && (typeof notes !== 'string' || notes.length > 1000)) {
      return NextResponse.json({ error: 'Notes must be 1000 characters or less' }, { status: 400 });
    }
    if (typeof duration !== 'number' || duration < 5 || duration > 480) {
      return NextResponse.json({ error: 'Invalid duration' }, { status: 400 });
    }

    const blockedField = getBlockedFieldLabel([
      { label: 'Customer name', value: customerName },
      { label: 'Notes', value: notes },
    ]);
    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    const normalizedCustomerPhone = formatPhoneNumber(customerPhone);

    // Verify all services belong to this business
    const services = await prisma.service.findMany({
      where: {
        id: { in: serviceIds },
        businessId: business.id,
      },
    });

    if (services.length !== serviceIds.length) {
      return NextResponse.json(
        { error: 'One or more services not found' },
        { status: 404 }
      );
    }

    // Verify staff belongs to this business (if provided)
    if (staffId && staffId !== 'anyone') {
      const staff = await prisma.staff.findFirst({
        where: {
          id: staffId,
          businessId: business.id,
        },
      });

      if (!staff) {
        return NextResponse.json(
          { error: 'Staff member not found' },
          { status: 404 }
        );
      }
    }

    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 60000);

    // Check for conflicts — only when a specific staff member is requested
    if (staffId && staffId !== 'anyone') {
      const conflicts = await prisma.appointment.findMany({
        where: {
          businessId: business.id,
          staffId,
          status: {
            in: ['pending', 'scheduled', 'confirmed'],
          },
          OR: [
            {
              AND: [
                { startTime: { lte: start } },
                { endTime: { gt: start } },
              ],
            },
            {
              AND: [
                { startTime: { lt: end } },
                { endTime: { gte: end } },
              ],
            },
            {
              AND: [
                { startTime: { gte: start } },
                { endTime: { lte: end } },
              ],
            },
          ],
        },
      });

      if (conflicts.length > 0) {
        return NextResponse.json(
          { error: 'Time slot is no longer available' },
          { status: 409 }
        );
      }
    }

    // Find or create customer
    let customer = await prisma.customer.findFirst({
      where: {
        businessId: business.id,
        OR: [{ phone: normalizedCustomerPhone }, { phone: customerPhone }],
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          businessId: business.id,
          name: customerName,
          phone: normalizedCustomerPhone,
          email: customerEmail || null,
          smsConsent: transactionalConsent,
          smsMarketingConsent: marketingConsent,
          smsMarketingConsentAt: marketingConsent ? new Date() : null,
        },
      });
    } else {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          name: customerName,
          ...(customerEmail && { email: customerEmail }),
          ...(transactionalConsent && !customer.smsOptedOut && { smsConsent: true }),
          ...(marketingConsent && !customer.smsOptedOut
            ? {
                smsMarketingConsent: true,
                smsMarketingConsentAt: new Date(),
              }
            : {}),
        },
      });
    }

    // Generate a short ID for the SMS link
    const shortId = Math.random().toString(36).substring(2, 9).toUpperCase();

    // Create appointment with pending status (business must confirm)
    const appointment = await prisma.appointment.create({
      data: {
        businessId: business.id,
        customerId: customer.id,
        serviceId: serviceIds[0],
        serviceIds,
        staffId: staffId && staffId !== 'anyone' ? staffId : null,
        startTime: start,
        endTime: end,
        duration,
        notes: notes || null,
        status: 'pending',
        shortId,
        source: 'online',
      },
      include: {
        customer: true,
        service: true,
        staff: true,
        business: {
          select: {
            name: true,
          },
        },
      },
    });

    if (transactionalConsent || marketingConsent) {
      await prisma.smsConsentEvent.create({
        data: {
          businessId: business.id,
          customerId: customer.id,
          phone: customer.phone || normalizedCustomerPhone,
          eventType: 'FORM_OPT_IN',
          source: 'booking_form',
          metadata: {
            transactionalConsent,
            marketingConsent,
            channel: 'public-business-slug-book',
          },
        },
      });
    }

    // Send SMS confirmation only if customer consented
    const appBase = getConfiguredAppBaseUrl();
    const appointmentUrl = `${appBase}/a/${shortId}`;
    const serviceName = services.map(s => s.name).join(', ');
    let smsResult = null;
    if (customer.phone && transactionalConsent && !customer.smsOptedOut) {
      smsResult = await sendAppointmentConfirmation(customer.phone, {
        customerName: customer.name,
        serviceName,
        staffName: appointment.staff?.fullName || 'our team',
        dateTime: appointment.startTime,
        businessName: appointment.business.name,
        duration: appointment.duration,
        appointmentUrl,
        timezone: business.timezone ?? undefined,
      });

      if (smsResult.success) {
        console.log('✅ SMS confirmation sent to:', customer.phone);
      } else {
        console.warn('⚠️  SMS failed:', smsResult.error);
      }
    }

    // Send email to business owner (non-blocking)
    if (business.notifyNewBookingEmail !== false) {
      const appBase = getConfiguredAppBaseUrl();
      sendNewBookingEmail(business.email, {
        businessName: business.name,
        customerName: customer.name,
        customerPhone: customer.phone,
        serviceName,
        staffName: appointment.staff?.fullName || null,
        dateTime: appointment.startTime,
        duration: appointment.duration,
        notes: appointment.notes,
        appointmentUrl: `${appBase}/dashboard/appointments`,
        timezone: business.timezone,
      }).catch(() => {});
    }

    // Create in-app notification for business
    await prisma.notification.create({
      data: {
        businessId: business.id,
        type: 'new_appointment',
        title: 'New Booking Request',
        message: `${customer.name} booked ${serviceName} for ${new Date(appointment.startTime).toLocaleString('en-US', { timeZone: business.timezone ?? undefined })}`,
        link: `/dashboard/appointments`,
      },
    });

    return NextResponse.json({
      success: true,
      appointment,
      message: 'Appointment request submitted! The business will confirm shortly.',
      smsNotification: smsResult?.success
        ? 'Confirmation SMS sent'
        : customer.phone
          ? 'SMS notification failed'
          : 'No phone number provided',
    });
  } catch (error: any) {
    console.error('Create booking error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create booking' },
      { status: 500 }
    );
  }
}
