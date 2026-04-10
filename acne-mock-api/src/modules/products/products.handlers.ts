import type { FastifyRequest, FastifyReply } from 'fastify';
import { store } from '../../store/Store.js';
import { paginate, parsePagination } from '../../utils/pagination.js';
import { filterItems } from '../../utils/filter.js';

export async function listProducts(
  request: FastifyRequest<{
    Querystring: {
      category?: string;
      gender?: string;
      season?: string;
      collection?: string;
      isCarryOver?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    };
  }>,
  reply: FastifyReply
) {
  const { category, gender, season, collection, isCarryOver, search } = request.query;

  let products = store.products;

  if (search) {
    const q = search.toLowerCase();
    products = products.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.styleNumber.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }

  products = filterItems(products, {
    ...(category && { category }),
    ...(gender && { gender }),
    ...(season && { season }),
    ...(collection && { collection }),
    ...(isCarryOver !== undefined && { isCarryOver }),
  });

  const pagination = parsePagination(request.query);
  return reply.send(paginate(products, pagination));
}

export async function getProduct(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const product = store.findById(store.products, request.params.id);
  if (!product) {
    return reply.status(404).send({ error: 'Product not found' });
  }

  const skus = store.findByField(store.skus, 'productId', product.id);
  return reply.send({ ...product, skus });
}

export async function listSkus(
  request: FastifyRequest<{
    Querystring: {
      productId?: string;
      colour?: string;
      size?: string;
      isActive?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    };
  }>,
  reply: FastifyReply
) {
  const { productId, colour, size, isActive, search } = request.query;

  let skus = store.skus;

  if (search) {
    const q = search.toLowerCase();
    skus = skus.filter(s => s.sku.toLowerCase().includes(q) || s.colour.toLowerCase().includes(q));
  }

  skus = filterItems(skus, {
    ...(productId && { productId }),
    ...(colour && { colour }),
    ...(size && { size }),
    ...(isActive !== undefined && { isActive }),
  });

  const pagination = parsePagination(request.query);
  return reply.send(paginate(skus, pagination));
}
