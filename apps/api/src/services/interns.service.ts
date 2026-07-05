import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, InternStatus } from '@prisma/client';
import {
  CreateInternDto,
  UpdateInternDto,
  RecordAttendanceDto,
  BulkAttendanceDto,
  SaturdayRosterDto,
  MarkSaturdayPresenceDto,
  ListInternsDto,
} from '../dto/intern.dto';

@Injectable()
export class InternsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInternDto) {
    return this.prisma.intern.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        department: dto.department,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async findAll(dto: ListInternsDto) {
    const { page = 1, limit = 50, search, status, department } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.InternWhereInput = {};
    if (status) where.status = status;
    if (department) where.department = department;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [interns, total] = await Promise.all([
      this.prisma.intern.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.intern.count({ where }),
    ]);

    return { data: interns, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const intern = await this.prisma.intern.findUnique({ where: { id } });
    if (!intern) throw new NotFoundException(`Intern ${id} not found`);
    return intern;
  }

  async update(id: string, dto: UpdateInternDto) {
    await this.findOne(id);
    return this.prisma.intern.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.intern.delete({ where: { id } });
  }

  async recordAttendance(dto: RecordAttendanceDto) {
    const intern = await this.findOne(dto.internId);
    const date = new Date(dto.date);

    if (dto.status === 'compensation_leave') {
      const available = await this.prisma.compensationLeave.findFirst({
        where: { internId: dto.internId, usedDate: null },
        orderBy: { earnedDate: 'asc' },
      });
      if (available) {
        await this.prisma.compensationLeave.update({
          where: { id: available.id },
          data: { usedDate: date },
        });
      }
    }

    return this.prisma.attendance.upsert({
      where: { internId_date: { internId: dto.internId, date } },
      create: {
        internId: dto.internId,
        date,
        status: dto.status,
        remarks: dto.remarks,
      },
      update: {
        status: dto.status,
        remarks: dto.remarks,
      },
    });
  }

  async bulkAttendance(dto: BulkAttendanceDto) {
    const date = new Date(dto.date);
    const results = await Promise.all(
      dto.records.map((record) =>
        this.recordAttendance({ ...record, date: dto.date }),
      ),
    );
    return results;
  }

  async createSaturdayRoster(dto: SaturdayRosterDto) {
    const date = new Date(dto.date);
    const results = await Promise.all(
      dto.internIds.map((internId) =>
        this.prisma.saturdayRoster.upsert({
          where: { internId_date: { internId, date } },
          create: { internId, date, present: false },
          update: {},
        }),
      ),
    );
    return results;
  }

  async markSaturdayPresence(dto: MarkSaturdayPresenceDto) {
    const date = new Date(dto.date);

    const roster = await this.prisma.saturdayRoster.upsert({
      where: { internId_date: { internId: dto.internId, date } },
      create: { internId: dto.internId, date, present: dto.present },
      update: { present: dto.present },
    });

    if (dto.present) {
      await this.prisma.compensationLeave.upsert({
        where: {
          id: (await this.prisma.compensationLeave.findFirst({
            where: { internId: dto.internId, earnedDate: date },
          }))?.id ?? '00000000-0000-0000-0000-000000000000',
        },
        create: { internId: dto.internId, earnedDate: date },
        update: {},
      });
    } else {
      await this.prisma.compensationLeave.deleteMany({
        where: { internId: dto.internId, earnedDate: date, usedDate: null },
      });
    }

    return roster;
  }

  async getSaturdayRoster(date: string) {
    return this.prisma.saturdayRoster.findMany({
      where: { date: new Date(date) },
      include: { intern: { select: { id: true, name: true, department: true } } },
      orderBy: { intern: { name: 'asc' } },
    });
  }

  async getInternDetails(id: string) {
    const intern = await this.findOne(id);

    const [attendances, saturdayRosters, compensationLeaves] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { internId: id },
        orderBy: { date: 'desc' },
      }),
      this.prisma.saturdayRoster.findMany({
        where: { internId: id },
        orderBy: { date: 'desc' },
      }),
      this.prisma.compensationLeave.findMany({
        where: { internId: id },
        orderBy: { earnedDate: 'desc' },
      }),
    ]);

    const totalWorkingDays = attendances.length;
    const presentDays = attendances.filter((a) => a.status === 'present').length;
    const absentDays = attendances.filter((a) => a.status === 'absent').length;
    const leaveDays = attendances.filter((a) => a.status === 'leave').length;
    const compLeaveDays = attendances.filter((a) => a.status === 'compensation_leave').length;

    const saturdaysPresent = saturdayRosters.filter((r) => r.present).length;
    const compLeaveEarned = compensationLeaves.length;
    const compLeaveUsed = compensationLeaves.filter((cl) => cl.usedDate !== null).length;
    const compLeaveRemaining = compLeaveEarned - compLeaveUsed;

    const attendancePercentage = totalWorkingDays > 0
      ? Math.round((presentDays + compLeaveDays) / totalWorkingDays * 100)
      : 100;

    let kpiStatus: 'green' | 'yellow' | 'red';
    if (attendancePercentage >= 90) kpiStatus = 'green';
    else if (attendancePercentage >= 75) kpiStatus = 'yellow';
    else kpiStatus = 'red';

    return {
      intern,
      stats: {
        totalWorkingDays,
        presentDays,
        absentDays,
        leaveDays,
        compLeaveDays,
        saturdaysPresent,
        compLeaveEarned,
        compLeaveUsed,
        compLeaveRemaining,
        attendancePercentage,
        kpiStatus,
      },
      attendances,
      saturdayRosters,
      compensationLeaves,
    };
  }

  async getAllInternsWithKpi() {
    const interns = await this.prisma.intern.findMany({
      where: { status: 'active' },
      orderBy: { name: 'asc' },
    });

    const results = await Promise.all(
      interns.map(async (intern) => {
        const attendances = await this.prisma.attendance.findMany({
          where: { internId: intern.id },
        });

        const totalWorkingDays = attendances.length;
        const presentDays = attendances.filter((a) => a.status === 'present').length;
        const compLeaveDays = attendances.filter((a) => a.status === 'compensation_leave').length;
        const absentDays = attendances.filter((a) => a.status === 'absent').length;
        const leaveDays = attendances.filter((a) => a.status === 'leave').length;

        const attendancePercentage = totalWorkingDays > 0
          ? Math.round((presentDays + compLeaveDays) / totalWorkingDays * 100)
          : 100;

        let kpiStatus: 'green' | 'yellow' | 'red';
        if (attendancePercentage >= 90) kpiStatus = 'green';
        else if (attendancePercentage >= 75) kpiStatus = 'yellow';
        else kpiStatus = 'red';

        return {
          ...intern,
          totalWorkingDays,
          presentDays,
          absentDays,
          leaveDays,
          compLeaveDays,
          attendancePercentage,
          kpiStatus,
        };
      }),
    );

    return {
      interns: results,
      summary: {
        total: results.length,
        green: results.filter((r) => r.kpiStatus === 'green').length,
        yellow: results.filter((r) => r.kpiStatus === 'yellow').length,
        red: results.filter((r) => r.kpiStatus === 'red').length,
      },
    };
  }
}
