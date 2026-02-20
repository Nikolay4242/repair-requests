import { 
  Controller, Get, Post, Patch, Body, Param, Query, 
  UseGuards, Request, ParseIntPipe, HttpCode, HttpStatus 
} from '@nestjs/common';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('requests')
@UseGuards(JwtAuthGuard)
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createRequestDto: CreateRequestDto) {
    return this.requestsService.create(createRequestDto);
  }

  @Get()
  async findAll(@Query() filters: any, @Request() req) {
    return this.requestsService.findAll(filters, req.user);
  }

  @Get('stats')
  async getStats() {
    return this.requestsService.getStats();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.requestsService.findOne(id);
  }

  @Patch(':id/assign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DISPATCHER)
  async assignToMaster(
    @Param('id', ParseIntPipe) id: number,
    @Body('masterId', ParseIntPipe) masterId: number,
    @Request() req,
  ) {
    return this.requestsService.assignToMaster(id, masterId, req.user.id);
  }

  @Patch(':id/take-to-work')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MASTER)
  async takeToWork(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.requestsService.takeToWork(id, req.user.id);
  }

  @Patch(':id/complete')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MASTER)
  async complete(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.requestsService.complete(id, req.user.id);
  }

  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DISPATCHER)
  async cancel(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.requestsService.cancel(id, req.user.id);
  }
}
