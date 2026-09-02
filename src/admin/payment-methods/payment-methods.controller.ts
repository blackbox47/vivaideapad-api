import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  buildPaginationMeta,
  parsePagination,
} from '../../common/utils/pagination';
import { PaymentMethodsService } from './payment-methods.service';
import {
  CreatePaymentMethodDto,
  PaymentMethodIdParamDto,
  PaymentMethodListQueryDto,
  UpdatePaymentMethodDto,
} from './dto/payment-methods.dto';
import { USER_ROLES } from '../../users/entities/user.entity';

@ApiTags('Admin')
@UseGuards(JwtAccessGuard)
@Roles(USER_ROLES.ADMINISTRATOR)
@Controller('admin/payment-methods')
export class AdminPaymentMethodsController {
  constructor(private readonly paymentMethods: PaymentMethodsService) {}

  @Get()
  @ApiOperation({ summary: 'List payment methods (paginated)' })
  async list(@Query() query: PaymentMethodListQueryDto) {
    const { page, limit } = parsePagination(query);
    const { data, total } = await this.paymentMethods.list({
      search: query.search,
      is_active: query.is_active,
      page,
      limit,
    });
    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  @Get('options')
  @ApiOperation({ summary: 'List active payment method options for dropdowns' })
  @ApiOkResponse({ description: 'List of active payment method options' })
  async options() {
    return this.paymentMethods.listOptions();
  }

  @Post()
  @ApiOperation({ summary: 'Create a payment method' })
  @ApiCreatedResponse({ description: 'Payment method created' })
  async create(@Body() body: CreatePaymentMethodDto) {
    return this.paymentMethods.create(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a payment method by id or code' })
  @ApiOkResponse({ description: 'The payment method' })
  async get(@Param() params: PaymentMethodIdParamDto) {
    return this.paymentMethods.findOne(params.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a payment method' })
  @ApiOkResponse({ description: 'Updated payment method' })
  async update(
    @Param() params: PaymentMethodIdParamDto,
    @Body() body: UpdatePaymentMethodDto,
  ) {
    return this.paymentMethods.update(params.id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a payment method' })
  @ApiNoContentResponse({ description: 'Payment method deleted' })
  async remove(@Param() params: PaymentMethodIdParamDto): Promise<void> {
    await this.paymentMethods.softDelete(params.id);
  }
}

@ApiTags('Contributor')
@UseGuards(JwtAccessGuard)
@Roles(USER_ROLES.CONTRIBUTOR)
@Controller(['contributor/payment-methods', 'payment-methods'])
export class ContributorPaymentMethodsController {
  constructor(private readonly paymentMethods: PaymentMethodsService) {}

  @Get()
  @ApiOperation({ summary: 'List payment method options for contributors' })
  @ApiOkResponse({ description: 'List of active payment method options' })
  async list() {
    return this.paymentMethods.listOptions();
  }

  @Get('options')
  @ApiOperation({ summary: 'List payment method options for contributors' })
  @ApiOkResponse({ description: 'List of active payment method options' })
  async options() {
    return this.paymentMethods.listOptions();
  }
}
