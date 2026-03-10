/**
 * Driver-facing Trip Evidence Controller
 * Used by the driver app for:
 *   - Sending SMS to passenger
 *   - Recording GPS milestones
 *   - Reading conversation thread (own trips only)
 */
import {
  Body, Controller, Get, Param, Post, UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TripEvidenceService } from './trip-evidence.service';
import { TripSmsService } from './trip-sms.service';

@Controller('driver-app/trips/:bookingId')
@UseGuards(JwtGuard)
export class TripDriverController {
  constructor(
    private readonly evidenceSvc: TripEvidenceService,
    private readonly smsSvc: TripSmsService,
  ) {}

  /** Get conversation thread for own trip */
  @Get('messages')
  async getMessages(
    @CurrentUser('sub') driverId: string,
    @CurrentUser('tenant_id') tenantId: string,
    @Param('bookingId') bookingId: string,
  ) {
    const rec = await this.evidenceSvc.getEvidenceRecord(tenantId, bookingId);
    // Security: driver can only see messages for trips assigned to them
    if (rec?.driver_id !== driverId) {
      return { messages: [], bridge_status: 'not_your_trip' };
    }
    const messages = await this.evidenceSvc.getSmsTranscript(tenantId, bookingId);
    return {
      messages,
      bridge_status: rec.sms_bridge_closed_at ? 'closed' : rec.sms_bridge_opened_at ? 'open' : 'not_started',
      evidence_status: rec.evidence_status,
    };
  }

  /** Driver sends a message to passenger */
  @Post('messages')
  async sendMessage(
    @CurrentUser('sub') driverId: string,
    @CurrentUser('tenant_id') tenantId: string,
    @Param('bookingId') bookingId: string,
    @Body() body: { message: string },
  ) {
    return this.smsSvc.driverSendMessage({
      tenantId,
      bookingId,
      driverId,
      messageBody: body.message,
    });
  }

  /** Driver records GPS milestone (called by app at each status transition) */
  @Post('gps')
  async recordGps(
    @CurrentUser('sub') driverId: string,
    @CurrentUser('tenant_id') tenantId: string,
    @Param('bookingId') bookingId: string,
    @Body() body: {
      milestone_type: string;
      latitude: number;
      longitude: number;
      accuracy_meters?: number;
    },
  ) {
    await this.evidenceSvc.recordMilestone({
      tenantId,
      bookingId,
      driverId,
      milestoneType: body.milestone_type as any,
      latitude: body.latitude,
      longitude: body.longitude,
      accuracyMeters: body.accuracy_meters,
    });
    return { recorded: true, milestone_type: body.milestone_type };
  }

  /** Get evidence summary for driver's own trip */
  @Get('evidence-summary')
  async getEvidenceSummary(
    @CurrentUser('sub') driverId: string,
    @CurrentUser('tenant_id') tenantId: string,
    @Param('bookingId') bookingId: string,
  ) {
    const rec = await this.evidenceSvc.getEvidenceRecord(tenantId, bookingId);
    if (!rec || rec.driver_id !== driverId) {
      return { has_evidence: false };
    }
    const milestones = await this.evidenceSvc.getMilestones(tenantId, bookingId);
    const msgs = await this.evidenceSvc.getSmsTranscript(tenantId, bookingId);
    return {
      has_evidence:    true,
      evidence_status: rec.evidence_status,
      is_frozen:       rec.evidence_status === 'frozen',
      milestone_count: milestones.length,
      message_count:   msgs.length,
      bridge_status:   rec.sms_bridge_closed_at ? 'closed' : rec.sms_bridge_opened_at ? 'open' : 'not_started',
    };
  }
}
